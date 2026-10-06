/** Rôles applicatifs, alimentés par les groupes Active Directory. Le N+1 n'est pas un rôle : il vient de l'attribut manager. */
export enum Role {
  DEMANDEUR = 'DEMANDEUR',
  LOGISTIQUE = 'LOGISTIQUE',
  MAGASINIER = 'MAGASINIER',
  ASSISTANTE_DIRECTION = 'ASSISTANTE_DIRECTION',
  ADMIN = 'ADMIN',
}
