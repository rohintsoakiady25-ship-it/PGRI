/** États des demandes — voir Figure 7 (diagramme d'états-transitions). */
export enum StatutDemande {
  BROUILLON = 'BROUILLON',
  EN_ATTENTE_N1 = 'EN_ATTENTE_N1',
  EN_ATTENTE_LOGISTIQUE = 'EN_ATTENTE_LOGISTIQUE',
  ALTERNATIVE_PROPOSEE = 'ALTERNATIVE_PROPOSEE', // salle
  VALIDEE = 'VALIDEE',                           // déplacement (affectée) / fournitures (au magasin)
  CONFIRMEE = 'CONFIRMEE',                       // salle
  EN_COURS = 'EN_COURS',                         // déplacement
  EN_PREPARATION = 'EN_PREPARATION',             // fournitures
  TERMINEE = 'TERMINEE',
  REMISE = 'REMISE',                             // fournitures
  REFUSEE = 'REFUSEE',
  ANNULEE = 'ANNULEE',
  LIBEREE = 'LIBEREE',                           // salle
}
