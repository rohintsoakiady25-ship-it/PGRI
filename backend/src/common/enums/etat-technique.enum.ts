/** État technique d'un véhicule. */
export enum EtatTechnique {
  BON = 'BON',
  A_SURVEILLER = 'A_SURVEILLER',
  EN_REPARATION = 'EN_REPARATION',
}

/** Disponibilité calculée (les missions en cours seront prises en compte avec les affectations). */
export enum Disponibilite {
  DISPONIBLE = 'DISPONIBLE',
  INDISPONIBLE = 'INDISPONIBLE',
  HORS_SERVICE = 'HORS_SERVICE',
}
