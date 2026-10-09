import type { Utilisateur } from './AuthContext';

/** L'utilisateur a-t-il au moins un de ces rôles ? (Affichage seulement : l'API vérifie aussi.) */
export function aUnRole(utilisateur: Utilisateur | null, ...roles: string[]): boolean {
  return Boolean(utilisateur?.roles.some((r) => roles.includes(r)));
}

/** Gestion des référentiels de la logistique (véhicules, chauffeurs). */
export const peutGererLogistique = (u: Utilisateur | null) => aUnRole(u, 'LOGISTIQUE', 'ADMIN');
