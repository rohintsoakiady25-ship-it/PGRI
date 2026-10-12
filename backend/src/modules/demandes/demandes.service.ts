import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { StatutDemande } from '../../common/enums/statut-demande.enum';
import { Utilisateur } from '../utilisateurs/entities/utilisateur.entity';
import { Demande } from './entities/demande.entity';
import { HistoriqueStatut } from './entities/historique-statut.entity';

/** Utilisateur connecté tel que le connaît le workflow (lu en base, pas seulement dans le jeton). */
export type Acteur = Pick<Utilisateur, 'id' | 'roles' | 'direction'>;

export const estGestionnaire = (a: Acteur) => a.roles.includes(Role.LOGISTIQUE) || a.roles.includes(Role.ADMIN);

/** Socle commun aux trois types de demande : références, historique des statuts, droits de consultation. */
@Injectable()
export class DemandesService {
  /**
   * Prochaine référence lisible pour un préfixe (ex. SAL-2026-0007).
   * Le verrou de transaction évite que deux demandes simultanées reçoivent la même référence.
   */
  async prochaineReference(m: EntityManager, prefixe: string): Promise<string> {
    const annee = new Date().getFullYear();
    const debut = `${prefixe}-${annee}-`;
    await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [debut]);
    const [{ dernier }] = await m.query(
      'SELECT max(substring(reference from $2)::int) AS dernier FROM demande WHERE reference LIKE $1',
      [`${debut}%`, `^${debut}(\\d+)$`],
    );
    return `${debut}${String((dernier ?? 0) + 1).padStart(4, '0')}`;
  }

  /** Change le statut et l'enregistre dans l'historique (auteur nul : transition automatique). */
  async changerStatut(
    m: EntityManager,
    demande: Demande,
    nouveau: StatutDemande,
    auteurId: string | null,
    commentaire: string | null = null,
  ): Promise<void> {
    const ancien = demande.statut ?? null;
    demande.statut = nouveau;
    await m.update(Demande, { id: demande.id }, { statut: nouveau });
    await m.insert(HistoriqueStatut, {
      demande: { id: demande.id },
      ancienStatut: ancien,
      nouveauStatut: nouveau,
      auteur: auteurId ? { id: auteurId } : null,
      commentaire,
    });
  }

  /**
   * Droit de consulter (et commenter) une demande : son auteur, la logistique et l'administrateur,
   * le N+1 de l'auteur, et l'assistante de direction de sa direction.
   */
  peutVoir(acteur: Acteur, demandeur: Pick<Utilisateur, 'id' | 'superieurDirectId' | 'direction'>): boolean {
    if (demandeur.id === acteur.id || estGestionnaire(acteur)) return true;
    if (demandeur.superieurDirectId === acteur.id) return true;
    return (
      acteur.roles.includes(Role.ASSISTANTE_DIRECTION) &&
      !!acteur.direction &&
      acteur.direction.toLowerCase() === (demandeur.direction ?? '').toLowerCase()
    );
  }
}
