import { EntityManager } from 'typeorm';
import { Affectation, AFFECTATIONS_ACTIVES, StatutAffectation } from './entities/affectation.entity';

/** Mission vue depuis la liste des voitures ou des chauffeurs. */
export interface MissionResume {
  debut: Date;
  fin: Date;
  /** Références des demandes servies (plusieurs si la mission est regroupée). */
  references: string[];
  destinations: string[];
}

export interface Occupation {
  /** Mission en cours (départ enregistré, ou période prévue qui couvre maintenant). */
  actuelle: MissionResume | null;
  /** Prochaine mission prévue. */
  prochaine: MissionResume | null;
}

/**
 * Missions actuelles et à venir de chaque véhicule (ou chauffeur), pour calculer sa disponibilité
 * dans les listes. Une seule requête pour toute la liste.
 */
export async function occupations(m: EntityManager, champ: 'vehiculeId' | 'chauffeurId'): Promise<Map<string, Occupation>> {
  const maintenant = new Date();
  const actives = await m
    .getRepository(Affectation)
    .createQueryBuilder('a')
    .leftJoinAndSelect('a.demandes', 'd')
    .where('a.statut IN (:...actives)', { actives: AFFECTATIONS_ACTIVES })
    .andWhere('(a.statut = :enCours OR a.dateHeureFin > :maintenant)', { enCours: StatutAffectation.EN_COURS, maintenant })
    .orderBy('a.dateHeureDebut', 'ASC')
    .getMany();

  const resultat = new Map<string, Occupation>();
  for (const a of actives) {
    const id = a[champ];
    const o = resultat.get(id) ?? { actuelle: null, prochaine: null };
    const resume: MissionResume = {
      debut: a.dateHeureDebut,
      fin: a.dateHeureFin,
      references: (a.demandes ?? []).map((d) => d.reference).sort(),
      destinations: [...new Set((a.demandes ?? []).map((d) => d.destination))],
    };
    const enCours = a.statut === StatutAffectation.EN_COURS || a.dateHeureDebut <= maintenant;
    if (enCours && !o.actuelle) o.actuelle = resume;
    else if (!enCours && !o.prochaine) o.prochaine = resume;
    resultat.set(id, o);
  }
  return resultat;
}

/** Une mission dans la fiche d'un véhicule ou d'un chauffeur. */
export interface MissionFiche {
  id: string;
  statut: StatutAffectation;
  debut: Date;
  fin: Date;
  heureDepartReelle: Date | null;
  heureRetourReelle: Date | null;
  incidents: string | null;
  vehicule: { immatriculation: string; marqueModele: string | null };
  chauffeur: { nomComplet: string; telephone: string | null };
  demandes: { id: string; reference: string; statut: string; demandeur: string; lieuDepart: string; destination: string; motif: string }[];
}

/** Nombre de missions passées montrées dans la fiche ; le reste est sur la page « Historique ». */
export const HISTORIQUE_FICHE = 5;

/**
 * Fiche d'un véhicule ou d'un chauffeur : missions à venir (prévues ou en cours, de la plus proche
 * à la plus lointaine) et les dernières missions passées (de la plus récente à la plus ancienne).
 */
export async function missionsDe(m: EntityManager, champ: 'vehiculeId' | 'chauffeurId', id: string) {
  const toutes = await toutesLesMissions(m, champ, id);
  const passees = toutes.filter((x) => !AFFECTATIONS_ACTIVES.includes(x.statut)).reverse();
  return {
    aVenir: toutes.filter((x) => AFFECTATIONS_ACTIVES.includes(x.statut)),
    historique: passees.slice(0, HISTORIQUE_FICHE),
    totalHistorique: passees.length,
  };
}

/** Historique complet : toutes les missions terminées ou annulées, de la plus récente à la plus ancienne. */
export async function historiqueDe(m: EntityManager, champ: 'vehiculeId' | 'chauffeurId', id: string) {
  return (await toutesLesMissions(m, champ, id)).filter((x) => !AFFECTATIONS_ACTIVES.includes(x.statut)).reverse();
}

async function toutesLesMissions(m: EntityManager, champ: 'vehiculeId' | 'chauffeurId', id: string): Promise<MissionFiche[]> {
  const liste = await m
    .getRepository(Affectation)
    .createQueryBuilder('a')
    .innerJoinAndSelect('a.vehicule', 'v')
    .innerJoinAndSelect('a.chauffeur', 'c')
    .leftJoinAndSelect('a.demandes', 'd')
    .leftJoinAndSelect('d.demandeur', 'u')
    .where(`a.${champ} = :id`, { id })
    .orderBy('a.dateHeureDebut', 'ASC')
    .getMany();
  const vue = (a: Affectation): MissionFiche => ({
    id: a.id,
    statut: a.statut,
    debut: a.dateHeureDebut,
    fin: a.dateHeureFin,
    heureDepartReelle: a.heureDepartReelle,
    heureRetourReelle: a.heureRetourReelle,
    incidents: a.incidents,
    vehicule: { immatriculation: a.vehicule.immatriculation, marqueModele: a.vehicule.marqueModele },
    chauffeur: { nomComplet: a.chauffeur.nomComplet, telephone: a.chauffeur.telephone },
    demandes: (a.demandes ?? [])
      .map((d) => ({
        id: d.id,
        reference: d.reference,
        statut: d.statut,
        demandeur: d.demandeur?.nomComplet ?? '—',
        lieuDepart: d.lieuDepart,
        destination: d.destination,
        motif: d.motif,
      }))
      .sort((x, y) => x.reference.localeCompare(y.reference)),
  });
  return liste.map(vue);
}
