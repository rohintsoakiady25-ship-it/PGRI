import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, EqualityFilter, InvalidCredentialsError } from 'ldapts';
import { Role } from '../../common/enums/role.enum';
import type { ProfilAnnuaire } from '../utilisateurs/utilisateurs.service';

interface ConfigLdap {
  url: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  attributLogin: string;
  verifierCertificat: boolean;
  groupes: Record<string, string>;
}

const premier = (v: unknown): string | null => {
  const x = Array.isArray(v) ? v[0] : v;
  if (x === undefined || x === null || x === '') return null;
  return Buffer.isBuffer(x) ? x.toString('utf8') : String(x);
};

/**
 * Authentification sur l'Active Directory de MNP (LDAP / LDAPS), en deux temps :
 * 1. le compte de service recherche l'utilisateur par son identifiant ;
 * 2. une seconde connexion avec le DN trouvé et le mot de passe saisi vérifie celui-ci auprès de l'annuaire.
 * PGRI ne stocke jamais le mot de passe AD.
 */
@Injectable()
export class LdapService {
  private readonly log = new Logger(LdapService.name);

  constructor(private readonly config: ConfigService) {}

  private get cfg(): ConfigLdap {
    return this.config.get<ConfigLdap>('ldap')!;
  }

  estConfigure(): boolean {
    const c = this.cfg;
    return Boolean(c.url && c.baseDn);
  }

  private client(): Client {
    const c = this.cfg;
    return new Client({
      url: c.url,
      timeout: 8000,
      connectTimeout: 8000,
      tlsOptions: c.url.startsWith('ldaps') ? { rejectUnauthorized: c.verifierCertificat } : undefined,
    });
  }

  async authentifier(identifiant: string, motDePasse: string): Promise<ProfilAnnuaire> {
    if (!this.estConfigure()) {
      throw new ServiceUnavailableException("La connexion Active Directory n'est pas configurée sur ce serveur.");
    }
    // Un mot de passe vide ferait une connexion anonyme acceptée par certains annuaires : on la refuse d'emblée.
    if (!motDePasse) throw new UnauthorizedException('Identifiant ou mot de passe incorrect.');

    const c = this.cfg;
    const recherche = this.client();
    let entree: Record<string, unknown> | undefined;
    try {
      if (c.bindDn) await recherche.bind(c.bindDn, c.bindPassword);
      const { searchEntries } = await recherche.search(c.baseDn, {
        scope: 'sub',
        filter: new EqualityFilter({ attribute: c.attributLogin, value: identifiant }),
        attributes: ['dn', c.attributLogin, 'displayName', 'cn', 'mail', 'department', 'company', 'memberOf'],
        sizeLimit: 2,
      });
      entree = searchEntries.length === 1 ? searchEntries[0] : undefined;
    } catch (e) {
      this.log.error(`Recherche LDAP impossible : ${(e as Error).message}`);
      throw new ServiceUnavailableException("L'annuaire Active Directory est injoignable. Réessayez ou utilisez un compte local.");
    } finally {
      await recherche.unbind().catch(() => undefined);
    }
    if (!entree) throw new UnauthorizedException('Identifiant ou mot de passe incorrect.');

    // Vérification du mot de passe par l'annuaire lui-même
    const verification = this.client();
    try {
      await verification.bind(String(entree.dn), motDePasse);
    } catch (e) {
      if (e instanceof InvalidCredentialsError) throw new UnauthorizedException('Identifiant ou mot de passe incorrect.');
      this.log.error(`Vérification LDAP impossible : ${(e as Error).message}`);
      throw new ServiceUnavailableException("L'annuaire Active Directory est injoignable. Réessayez ou utilisez un compte local.");
    } finally {
      await verification.unbind().catch(() => undefined);
    }

    const groupes = (Array.isArray(entree.memberOf) ? entree.memberOf : [entree.memberOf])
      .filter(Boolean)
      .map((g) => String(g).toLowerCase());
    const roles: Role[] = [Role.DEMANDEUR];
    for (const [role, dnGroupe] of Object.entries(c.groupes)) {
      if (dnGroupe && groupes.includes(dnGroupe.toLowerCase())) roles.push(role as Role);
    }

    return {
      login: premier(entree[c.attributLogin]) ?? identifiant,
      nomComplet: premier(entree.displayName) ?? premier(entree.cn) ?? identifiant,
      email: premier(entree.mail),
      direction: premier(entree.company),
      service: premier(entree.department),
      roles,
    };
  }
}
