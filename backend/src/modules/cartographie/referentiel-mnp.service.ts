import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ErreurUgs, UgsClientService } from './ugs-client.service';

/** Aire protégée telle que PGRI la propose comme destination. */
export interface AireProtegee {
  id: string;
  sigle: string | null;
  nom: string;
  statut: string | null;
  /** Point d'arrivée proposé : à l'intérieur de l'aire (géométrie simplifiée). */
  lat: number;
  lon: number;
  uniteGestion: { id: string; code: string | null; nom: string } | null;
}

export interface UniteGestion {
  id: string;
  code: string | null;
  nom: string;
  description: string | null;
  aires: { id: string; nom: string }[];
}

export interface Referentiel {
  /** false : API non configurée ou injoignable (le formulaire garde la recherche de lieux habituelle). */
  disponible: boolean;
  aires: AireProtegee[];
  unites: UniteGestion[];
}

type Position = number[];
type Anneau = Position[];
interface Geometrie {
  type: string;
  coordinates?: unknown;
}
export interface Feature {
  type: 'Feature';
  geometry: Geometrie | null;
  properties?: Record<string, unknown> | null;
}

/** Référentiel et contours gardés une heure : les listes changent rarement et le débit de l'API est partagé (100/min par IP). */
const DUREE_CACHE_MS = 60 * 60_000;

const texte = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Anneaux extérieurs d'un Polygon ou d'un MultiPolygon. */
function anneauxExterieurs(g: Geometrie | null): Anneau[] {
  if (!g || !Array.isArray(g.coordinates)) return [];
  if (g.type === 'Polygon') return [(g.coordinates as Anneau[])[0]].filter(Boolean);
  if (g.type === 'MultiPolygon') return (g.coordinates as Anneau[][]).map((p) => p[0]).filter(Boolean);
  if (g.type === 'Point') return [[g.coordinates as Position]];
  return [];
}

/** Aire signée (formule du lacet) et centre de gravité d'un anneau. */
function gravite(a: Anneau): { aire: number; x: number; y: number } {
  let s = 0, cx = 0, cy = 0;
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const f = a[j][0] * a[i][1] - a[i][0] * a[j][1];
    s += f;
    cx += (a[j][0] + a[i][0]) * f;
    cy += (a[j][1] + a[i][1]) * f;
  }
  if (Math.abs(s) < 1e-12) {
    const n = a.length || 1;
    return { aire: 0, x: a.reduce((t, p) => t + p[0], 0) / n, y: a.reduce((t, p) => t + p[1], 0) / n };
  }
  return { aire: Math.abs(s / 2), x: cx / (3 * s), y: cy / (3 * s) };
}

/** Abscisses où l'horizontale de latitude y coupe l'anneau, triées. */
function intersections(a: Anneau, y: number): number[] {
  const xs: number[] = [];
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
    const [x1, y1] = a[j];
    const [x2, y2] = a[i];
    if ((y1 > y) !== (y2 > y)) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
  }
  return xs.sort((p, q) => p - q);
}

/**
 * Point représentatif d'une aire : centre de gravité de sa plus grande partie s'il tombe dedans,
 * sinon le milieu du plus large segment intérieur sur la même latitude (toujours dans l'aire).
 */
function pointInterieur(g: Geometrie | null): { lon: number; lat: number } | null {
  const anneaux = anneauxExterieurs(g).filter((a) => a.length);
  if (!anneaux.length) return null;
  const principal = anneaux.map((a) => ({ a, ...gravite(a) })).sort((p, q) => q.aire - p.aire)[0];
  if (principal.a.length < 3) return { lon: principal.x, lat: principal.y };
  const xs = intersections(principal.a, principal.y);
  let meilleur: [number, number] | null = null;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (principal.x >= xs[i] && principal.x <= xs[i + 1]) return { lon: principal.x, lat: principal.y };
    if (!meilleur || xs[i + 1] - xs[i] > meilleur[1] - meilleur[0]) meilleur = [xs[i], xs[i + 1]];
  }
  return meilleur ? { lon: (meilleur[0] + meilleur[1]) / 2, lat: principal.y } : { lon: principal.x, lat: principal.y };
}

/**
 * Aires protégées et unités de gestion de MNP, lues dans mnp-ugs-api (scopes protected-areas:read
 * et management-units:read) et mises en forme pour le formulaire de déplacement.
 */
@Injectable()
export class ReferentielMnpService {
  private readonly logger = new Logger(ReferentielMnpService.name);
  private cache: { valeur: Referentiel; expireA: number } | null = null;
  private chargement: Promise<Referentiel> | null = null;
  private readonly contours = new Map<string, { valeur: Feature; expireA: number }>();
  /** Contours en cours de lecture : des demandes simultanées pour la même aire partagent un seul appel. */
  private readonly contoursEnCours = new Map<string, Promise<Feature>>();

  constructor(private readonly ugs: UgsClientService) {}

  async referentiel(): Promise<Referentiel> {
    if (!this.ugs.estDisponible()) return { disponible: false, aires: [], unites: [] };
    if (this.cache && Date.now() < this.cache.expireA) return this.cache.valeur;
    this.chargement ??= this.charger().finally(() => (this.chargement = null));
    try {
      const valeur = await this.chargement;
      this.cache = { valeur, expireA: Date.now() + DUREE_CACHE_MS };
      return valeur;
    } catch (e) {
      this.logger.warn(`Référentiel MNP non chargé : ${(e as Error).message}`);
      // Ancienne version plutôt que rien ; sinon le formulaire continue sans les aires protégées
      return this.cache?.valeur ?? { disponible: false, aires: [], unites: [] };
    }
  }

  /** Contour complet d'une aire (GeoJSON Feature), pour l'afficher sur la carte. */
  async contour(id: string): Promise<Feature> {
    const enCache = this.contours.get(id);
    if (enCache && Date.now() < enCache.expireA) return enCache.valeur;
    if (!this.ugs.estDisponible()) throw new ServiceUnavailableException('Le référentiel des aires protégées n’est pas configuré.');
    let lecture = this.contoursEnCours.get(id);
    if (!lecture) {
      lecture = this.ugs
        .lire<Feature>(`/protected-areas/geojson/${encodeURIComponent(id)}`)
        .then((f) => {
          const valeur: Feature = { type: 'Feature', geometry: f.geometry ?? null, properties: { id, nom: texte(f.properties?.name) } };
          this.contours.set(id, { valeur, expireA: Date.now() + DUREE_CACHE_MS });
          return valeur;
        })
        .finally(() => this.contoursEnCours.delete(id));
      this.contoursEnCours.set(id, lecture);
    }
    try {
      return await lecture;
    } catch (e) {
      if (e instanceof ErreurUgs && (e.statut === 404 || e.statut === 400)) throw new NotFoundException('Aire protégée introuvable.');
      this.logger.warn(`Contour de l’aire ${id} non chargé : ${(e as Error).message}`);
      throw new ServiceUnavailableException('Le contour de l’aire protégée est indisponible pour le moment.');
    }
  }

  private async charger(): Promise<Referentiel> {
    const [collection, unitesBrutes] = await Promise.all([
      this.ugs.lire<{ features?: Feature[] }>('/protected-areas/geojson'),
      this.ugs.lire<Record<string, unknown>[]>('/management-units'),
    ]);

    const unites: UniteGestion[] = (Array.isArray(unitesBrutes) ? unitesBrutes : [])
      .filter((u) => texte(u.id) && texte(u.name))
      .map((u) => ({
        id: texte(u.id)!,
        code: texte(u.code),
        nom: texte(u.name)!,
        description: texte(u.description),
        aires: (Array.isArray(u.protectedAreas) ? (u.protectedAreas as Record<string, unknown>[]) : [])
          .filter((a) => texte(a.id))
          .map((a) => ({ id: texte(a.id)!, nom: texte(a.name) ?? texte(a.sigle) ?? '' })),
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

    const uniteDe = new Map<string, UniteGestion>();
    for (const u of unites) for (const a of u.aires) uniteDe.set(a.id, u);

    const aires: AireProtegee[] = [];
    for (const f of collection?.features ?? []) {
      const p = f.properties ?? {};
      const id = texte(p.id);
      const nom = texte(p.name) ?? texte(p.sigle);
      const point = pointInterieur(f.geometry);
      if (!id || !nom || !point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
      const u = uniteDe.get(id);
      aires.push({
        id,
        sigle: texte(p.sigle),
        nom,
        statut: texte(p.status),
        lat: Math.round(point.lat * 1e6) / 1e6,
        lon: Math.round(point.lon * 1e6) / 1e6,
        uniteGestion: u ? { id: u.id, code: u.code, nom: u.nom } : null,
      });
    }
    aires.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    this.logger.log(`Référentiel MNP chargé : ${aires.length} aires protégées, ${unites.length} unités de gestion.`);
    return { disponible: true, aires, unites };
  }
}
