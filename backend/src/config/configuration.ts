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
    /** Domaine AD pour la connexion directe « identifiant@domaine » (mode sans compte de service). */
    domaine: process.env.LDAP_DOMAINE ?? '',
    baseDn: process.env.LDAP_BASE_DN ?? '',
    bindDn: process.env.LDAP_BIND_DN ?? '',
    bindPassword: process.env.LDAP_BIND_PASSWORD ?? '',
    /** Attribut qui porte l'identifiant de connexion (sAMAccountName sur un Active Directory). */
    attributLogin: process.env.LDAP_ATTRIBUT_LOGIN || 'sAMAccountName',
    /** Vérification du certificat LDAPS (à laisser à true hors tests). */
    verifierCertificat: process.env.LDAP_TLS_VERIFIER !== 'false',
    /** Certificat (PEM) de l'autorité ou du contrôleur de domaine, s'il n'est pas reconnu par le système (auto-signé). */
    certificatCa: process.env.LDAP_TLS_CA ?? '',
    /** Nom attendu dans le certificat, quand LDAP_URL utilise une adresse IP. */
    nomServeur: process.env.LDAP_TLS_NOM_SERVEUR ?? '',
    /** Groupes AD donnant un rôle PGRI (facultatif) : nom du groupe (CN) ou DN complet. */
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
  /** E-mails automatiques par Microsoft Graph (application Azure AD) ; désactivés si un réglage manque. */
  mail: {
    tenantId: process.env.AZURE_TENANT_ID ?? '',
    clientId: process.env.AZURE_CLIENT_ID ?? '',
    clientSecret: process.env.AZURE_CLIENT_SECRET ?? '',
    /** Boîte d'envoi (ex. webmaster@mnparks.mg). */
    expediteur: process.env.MAIL_SENDER_ADDRESS ?? '',
  },
  /** API mnp-ugs-api de la DSII (aires protégées, unités de gestion) ; désactivée si un réglage manque. */
  ugs: {
    baseUrl: (process.env.MNP_UGS_BASE_URL ?? '').replace(/\/+$/, ''),
    clientId: process.env.MNP_UGS_CLIENT_ID ?? '',
    clientSecret: process.env.MNP_UGS_CLIENT_SECRET ?? '',
    /** Scopes demandés, séparés par des espaces (vide : tous ceux accordés à PGRI par la DSII). */
    scope: process.env.MNP_UGS_SCOPE ?? 'protected-areas:read management-units:read',
  },
});
