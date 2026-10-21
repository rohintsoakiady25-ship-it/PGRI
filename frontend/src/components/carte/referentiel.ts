import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { Lieu } from './lieux';

/** Aire protégée du référentiel MNP (API mnp-ugs-api, lue par le backend PGRI). */
export interface AireProtegee {
  id: string;
  sigle: string | null;
  nom: string;
  statut: string | null;
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

export interface ReferentielMnp {
  disponible: boolean;
  aires: AireProtegee[];
  unites: UniteGestion[];
}

export interface ContourAire {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown } | null;
  properties: { id: string; nom: string | null } | null;
}

const VIDE: ReferentielMnp = { disponible: false, aires: [], unites: [] };
// Une seule lecture par session de page : le backend garde lui-même le référentiel une heure
let enCours: Promise<ReferentielMnp> | null = null;

function charger(): Promise<ReferentielMnp> {
  enCours ??= api
    .get<ReferentielMnp>('/cartographie/referentiel')
    .then((r) => r.data)
    .catch(() => {
      enCours = null; // nouvel essai au prochain affichage
      return VIDE;
    });
  return enCours;
}

/** Référentiel MNP ; vide (disponible: false) tant qu'il n'est pas chargé ou si l'API n'est pas configurée. */
export function useReferentielMnp(): ReferentielMnp {
  const [r, setR] = useState<ReferentielMnp>(VIDE);
  useEffect(() => {
    let actif = true;
    void charger().then((v) => actif && setR(v));
    return () => {
      actif = false;
    };
  }, []);
  return r;
}

export const contourAire = (id: string, signal?: AbortSignal) =>
  api.get<ContourAire>(`/cartographie/aires-protegees/${id}/contour`, { signal }).then((r) => r.data);

/** Lieu de destination correspondant à une aire protégée. */
export function lieuDeAire(a: AireProtegee): Lieu {
  const ug = a.uniteGestion ? `UG ${a.uniteGestion.nom}` : null;
  return {
    nom: a.nom,
    detail: ['Aire protégée', a.sigle, ug].filter(Boolean).join(' · '),
    lon: a.lon,
    lat: a.lat,
    aireId: a.id,
  };
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Aires dont le nom, le sigle ou l'unité de gestion contient le texte saisi (sans tenir compte des accents). */
export function filtrerAires(aires: AireProtegee[], texte: string, max = 5): AireProtegee[] {
  const q = sansAccents(texte.trim());
  if (q.length < 2) return [];
  const score = (a: AireProtegee) => {
    const nom = sansAccents(a.nom);
    if (nom.startsWith(q) || sansAccents(a.sigle ?? '') === q) return 0;
    if (nom.includes(q) || sansAccents(a.sigle ?? '').includes(q)) return 1;
    if (sansAccents(a.uniteGestion?.nom ?? '').includes(q)) return 2;
    return -1;
  };
  return aires
    .map((a) => ({ a, s: score(a) }))
    .filter((x) => x.s >= 0)
    .sort((x, y) => x.s - y.s)
    .slice(0, max)
    .map((x) => x.a);
}

