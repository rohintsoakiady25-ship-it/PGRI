import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const FUSEAU = 'Indian/Antananarivo';
/** Heures ouvrables d'une salle par jour de semaine (8h–18h), pour le taux d'occupation. */
const HEURES_PAR_JOUR = 10;
const JOURS_ALERTE = 30;

const jourLocal = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: FUSEAU }).format(d); // AAAA-MM-JJ
const moisCourant = () => jourLocal(new Date()).slice(0, 7);

/** Bornes d'un mois « AAAA-MM » en heure de Madagascar (UTC+3, sans heure d'été). */
function bornes(mois: string) {
  const [a, m] = mois.split('-').map(Number);
  const suivant = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
  return { debut: new Date(`${mois}-01T00:00:00+03:00`), fin: new Date(`${suivant}-01T00:00:00+03:00`) };
}

/** Les n mois qui finissent par `mois` (du plus ancien au plus récent). */
function moisPrecedents(mois: string, n: number) {
  const [a, m] = mois.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** Jours ouvrables (lundi–vendredi) d'un mois. */
function joursOuvrables(mois: string) {
  const [a, m] = mois.split('-').map(Number);
  let n = 0;
  for (let j = 1; j <= new Date(Date.UTC(a, m, 0)).getUTCDate(); j++) {
    const jour = new Date(Date.UTC(a, m - 1, j)).getUTCDay();
    if (jour !== 0 && jour !== 6) n++;
  }
  return n;
}

const nombre = (v: unknown) => Number(v ?? 0);

/**
 * Tableau de bord de la logistique : ce qui attend une décision, la situation du jour, les alertes
 * (stock, échéances des véhicules) et les indicateurs d'un mois (demandes, véhicules, salles, fournitures).
 */
@Injectable()
export class TableauDeBordService {
  constructor(@InjectDataSource() private readonly source: DataSource) {}

  async indicateurs(moisDemande?: string) {
    const mois = moisDemande ?? moisCourant();
    const { debut, fin } = bornes(mois);
    const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => this.source.query(sql, params) as Promise<T[]>;
    const maintenant = new Date();
    const aujourdhui = jourLocal(maintenant);
    const limite = jourLocal(new Date(maintenant.getTime() + JOURS_ALERTE * 86_400_000));
    const debutJour = new Date(`${aujourdhui}T00:00:00+03:00`);
    const finJour = new Date(debutJour.getTime() + 86_400_000);

    const [aTraiter, missions, flotte, reunions, stock, echeances, parMois, vehicules, salles, directions, articles] = await Promise.all([
      // Demandes qui attendent la logistique, par module
      q(`SELECT type, count(*)::int AS n FROM demande WHERE statut = 'EN_ATTENTE_LOGISTIQUE' GROUP BY type`),
      q(`SELECT count(*)::int AS n FROM affectation WHERE statut = 'EN_COURS' OR (statut = 'PREVUE' AND date_heure_debut <= now() AND date_heure_fin > now())`),
      q(`SELECT count(*)::int AS total,
                count(*) FILTER (WHERE id IN (SELECT vehicule_id FROM affectation WHERE statut = 'EN_COURS'
                                              OR (statut = 'PREVUE' AND date_heure_debut <= now() AND date_heure_fin > now())))::int AS en_mission
         FROM vehicule WHERE actif`),
      q(`SELECT count(*)::int AS n FROM demande WHERE type = 'SALLE' AND statut IN ('CONFIRMEE', 'TERMINEE')
         AND creneau_debut < $2 AND creneau_fin > $1`, [debutJour, finJour]),
      q(`SELECT reference, nom AS designation, unite, quantite_stock AS quantite, seuil_alerte AS seuil
         FROM article_stock WHERE actif AND quantite_stock <= seuil_alerte ORDER BY quantite_stock, nom`),
      q(`SELECT immatriculation, 'Assurance' AS quoi, assurance_fin::text AS fin FROM vehicule
           WHERE actif AND assurance_fin IS NOT NULL AND assurance_fin <= $1
         UNION ALL
         SELECT immatriculation, 'Visite technique', visite_technique_fin::text FROM vehicule
           WHERE actif AND visite_technique_fin IS NOT NULL AND visite_technique_fin <= $1
         ORDER BY fin`, [limite]),
      // Demandes soumises par mois et par module (6 derniers mois)
      q(`SELECT to_char(soumis_le AT TIME ZONE '${FUSEAU}', 'YYYY-MM') AS mois, type, count(*)::int AS n
         FROM demande WHERE soumis_le >= $1 AND soumis_le < $2 GROUP BY 1, 2`,
        [bornes(moisPrecedents(mois, 6)[0]).debut, fin]),
      // Utilisation des véhicules : missions du mois (hors annulées)
      q(`SELECT v.immatriculation, count(a.id)::int AS missions,
                coalesce(sum(extract(epoch FROM (coalesce(a.heure_retour_reelle, a.date_heure_fin) - coalesce(a.heure_depart_reelle, a.date_heure_debut)))) / 3600, 0)::float AS heures
         FROM vehicule v LEFT JOIN affectation a ON a.vehicule_id = v.id AND a.statut <> 'ANNULEE'
              AND a.date_heure_debut >= $1 AND a.date_heure_debut < $2
         WHERE v.actif GROUP BY v.immatriculation ORDER BY missions DESC, v.immatriculation`, [debut, fin]),
      // Occupation des salles : heures réservées (confirmées ou passées) du mois
      q(`SELECT s.nom, coalesce(sum(extract(epoch FROM (least(d.creneau_fin, $2) - greatest(d.creneau_debut, $1)))) / 3600, 0)::float AS heures,
                count(d.id)::int AS reunions
         FROM salle s LEFT JOIN demande d ON d.salle_id = s.id AND d.type = 'SALLE' AND d.statut IN ('CONFIRMEE', 'TERMINEE')
              AND d.creneau_debut < $2 AND d.creneau_fin > $1
         WHERE s.actif GROUP BY s.nom ORDER BY s.nom`, [debut, fin]),
      // Fournitures remises dans le mois, par direction du demandeur
      q(`SELECT coalesce(nullif(u.direction, ''), 'Non renseignée') AS direction, count(DISTINCT d.id)::int AS demandes,
                coalesce(sum(l.quantite_livree), 0)::int AS articles
         FROM bon_de_sortie b JOIN demande d ON d.id = b.demande_id JOIN utilisateur u ON u.id = d.demandeur_id
              JOIN ligne_fourniture l ON l.demande_id = d.id
         WHERE b.date_emission >= $1 AND b.date_emission < $2 GROUP BY 1 ORDER BY articles DESC`, [debut, fin]),
      // Articles les plus sortis du mois
      q(`SELECT a.nom AS designation, a.unite, sum(m.quantite)::int AS quantite
         FROM mouvement_stock m JOIN article_stock a ON a.id = m.article_id
         WHERE m.type = 'SORTIE' AND m.date >= $1 AND m.date < $2 GROUP BY a.nom, a.unite ORDER BY quantite DESC LIMIT 8`, [debut, fin]),
    ]);

    const parType = (type: string) => nombre(aTraiter.find((x) => x.type === type)?.n);
    const ouvrables = joursOuvrables(mois) * HEURES_PAR_JOUR;
    return {
      mois,
      aTraiter: { deplacements: parType('DEPLACEMENT'), salles: parType('SALLE'), fournitures: parType('FOURNITURE') },
      aujourdhui: {
        missionsEnCours: nombre(missions[0]?.n),
        vehiculesEnMission: nombre(flotte[0]?.en_mission),
        vehiculesActifs: nombre(flotte[0]?.total),
        reunions: nombre(reunions[0]?.n),
      },
      alertes: {
        stock: stock.map((a) => ({ ...a, quantite: nombre(a.quantite), seuil: nombre(a.seuil) })),
        echeances: echeances.map((e) => ({ ...e, expiree: String(e.fin) < aujourdhui })),
      },
      demandesParMois: moisPrecedents(mois, 6).map((m) => {
        const n = (type: string) => nombre(parMois.find((x) => x.mois === m && x.type === type)?.n);
        return { mois: m, salles: n('SALLE'), deplacements: n('DEPLACEMENT'), fournitures: n('FOURNITURE') };
      }),
      vehicules: vehicules.map((v) => ({ immatriculation: v.immatriculation, missions: nombre(v.missions), heures: Math.round(nombre(v.heures) * 10) / 10 })),
      salles: salles.map((s) => ({
        nom: s.nom,
        reunions: nombre(s.reunions),
        heures: Math.round(nombre(s.heures) * 10) / 10,
        heuresOuvrables: ouvrables,
        taux: ouvrables ? Math.min(1, nombre(s.heures) / ouvrables) : 0,
      })),
      fournitures: {
        parDirection: directions.map((d) => ({ direction: d.direction, demandes: nombre(d.demandes), articles: nombre(d.articles) })),
        topArticles: articles.map((a) => ({ designation: a.designation, unite: a.unite, quantite: nombre(a.quantite) })),
      },
    };
  }
}
