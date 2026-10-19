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
