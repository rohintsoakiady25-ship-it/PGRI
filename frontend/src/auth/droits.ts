import type { Utilisateur } from './AuthContext';

/** L'utilisateur a-t-il au moins un de ces rôles ? (Affichage seulement : l'API vérifie aussi.) */
export function aUnRole(utilisateur: Utilisateur | null, ...roles: string[]): boolean {
  return Boolean(utilisateur?.roles.some((r) => roles.includes(r)));
}

/** Listes des voitures et des chauffeurs (consultation et gestion) : logistique et administrateur. */
export const peutGererReferentiels = (u: Utilisateur | null) => aUnRole(u, 'LOGISTIQUE', 'ADMIN');

/** Suivi des demandes de fournitures des autres : N+1, assistante de direction, logistique, magasinier. */
export const peutSuivreFournitures = (u: Utilisateur | null) =>
  aUnRole(u, 'LOGISTIQUE', 'ADMIN', 'ASSISTANTE_DIRECTION', 'MAGASINIER') || Boolean(u?.estSuperieur);

/** Suivi des demandes de déplacement des autres : N+1 (validation), assistante de direction (information), logistique. */
export const peutSuivreDeplacements = (u: Utilisateur | null) =>
  aUnRole(u, 'LOGISTIQUE', 'ADMIN', 'ASSISTANTE_DIRECTION') || Boolean(u?.estSuperieur);

/** Suivi des demandes de salle des autres : logistique (validation), N+1 et assistante de direction (avis). */
export const peutSuivreSalles = (u: Utilisateur | null) =>
  aUnRole(u, 'LOGISTIQUE', 'ADMIN', 'ASSISTANTE_DIRECTION') || Boolean(u?.estSuperieur);
