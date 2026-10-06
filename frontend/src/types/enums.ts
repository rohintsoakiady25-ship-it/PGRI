// Miroir des énumérations du backend (backend/src/common/enums).
export type Role = 'DEMANDEUR' | 'LOGISTIQUE' | 'MAGASINIER' | 'ASSISTANTE_DIRECTION' | 'ADMIN';
export type TypeDemande = 'DEPLACEMENT' | 'SALLE' | 'FOURNITURE';
export type StatutDemande =
  | 'BROUILLON' | 'EN_ATTENTE_N1' | 'EN_ATTENTE_LOGISTIQUE' | 'ALTERNATIVE_PROPOSEE'
  | 'VALIDEE' | 'CONFIRMEE' | 'EN_COURS' | 'EN_PREPARATION'
  | 'TERMINEE' | 'REMISE' | 'REFUSEE' | 'ANNULEE' | 'LIBEREE';
