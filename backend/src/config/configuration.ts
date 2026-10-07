const vrai = (v: string | undefined) => v === 'true' || v === '1';

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    /** Développement uniquement : crée/ajuste les tables à partir des entités. En production : migrations. */
    synchronize: vrai(process.env.DB_SYNCHRONIZE),
  },
  ldap: {
    /** Vide = connexion Active Directory désactivée. */
    url: process.env.LDAP_URL ?? '',
    baseDn: process.env.LDAP_BASE_DN ?? '',
    bindDn: process.env.LDAP_BIND_DN ?? '',
    bindPassword: process.env.LDAP_BIND_PASSWORD ?? '',
    /** Attribut qui porte l'identifiant de connexion (sAMAccountName sur un Active Directory). */
    attributLogin: process.env.LDAP_ATTRIBUT_LOGIN || 'sAMAccountName',
    /** Vérification du certificat LDAPS (à laisser à true hors tests). */
    verifierCertificat: process.env.LDAP_TLS_VERIFIER !== 'false',
    /** DN des groupes AD donnant un rôle PGRI (facultatif). */
    groupes: {
      ADMIN: process.env.LDAP_GROUPE_ADMIN ?? '',
      LOGISTIQUE: process.env.LDAP_GROUPE_LOGISTIQUE ?? '',
      MAGASINIER: process.env.LDAP_GROUPE_MAGASINIER ?? '',
      ASSISTANTE_DIRECTION: process.env.LDAP_GROUPE_ASSISTANTE_DIRECTION ?? '',
    },
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    from: process.env.SMTP_FROM,
  },
});
