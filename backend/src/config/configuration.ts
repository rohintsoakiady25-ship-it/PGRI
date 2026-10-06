export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },
  ldap: {
    url: process.env.LDAP_URL,
    baseDn: process.env.LDAP_BASE_DN,
    bindDn: process.env.LDAP_BIND_DN,
    bindPassword: process.env.LDAP_BIND_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    from: process.env.SMTP_FROM,
  },
});
