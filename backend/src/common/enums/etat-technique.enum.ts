/** État technique d'un véhicule. */
export enum EtatTechnique {
  BON = 'BON',
  A_SURVEILLER = 'A_SURVEILLER',
  EN_REPARATION = 'EN_REPARATION',
}

/** Disponibilité calculée à partir de l'état et des missions affectées. */
export enum Disponibilite {
  DISPONIBLE = 'DISPONIBLE',
  EN_MISSION = 'EN_MISSION',
  INDISPONIBLE = 'INDISPONIBLE',
  HORS_SERVICE = 'HORS_SERVICE',
}
