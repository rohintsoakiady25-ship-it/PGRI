import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConnectionOptions } from 'node:tls';
import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, EqualityFilter, InvalidCredentialsError } from 'ldapts';
import { Role } from '../../common/enums/role.enum';
import type { ProfilAnnuaire } from '../utilisateurs/utilisateurs.service';

interface ConfigLdap {
  url: string;
  domaine: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  attributLogin: string;
  verifierCertificat: boolean;
  certificatCa: string;
  nomServeur: string;
  groupes: Record<string, string>;
}

const ATTRIBUTS = ['sAMAccountName', 'displayName', 'cn', 'mail', 'department', 'company', 'physicalDeliveryOfficeName', 'memberOf'];

const premier = (v: unknown): string | null => {
  const x = Array.isArray(v) ? v[0] : v;
  if (x === undefined || x === null || x === '') return null;
  return Buffer.isBuffer(x) ? x.toString('utf8') : String(x);
};

/** « prenom.nom », « prenom.nom@domaine » ou « DOMAINE\prenom.nom » → « prenom.nom ». */
export function extraireIdentifiant(saisie: string): string {
  let id = saisie.trim();
  if (id.includes('\\')) id = id.split('\\').slice(1).join('\\');
  if (id.includes('@')) id = id.split('@')[0];
  return id;
}

/** CN d'un DN de groupe : « CN=PGRI-Admins,OU=Groupes,DC=… » → « pgri-admins ». */
const cnDuGroupe = (dn: string) => (/^CN=([^,]+)/i.exec(dn)?.[1] ?? dn).toLowerCase();

/**
 * Authentification sur l'Active Directory de MNP (LDAP / LDAPS). Deux modes :
 * - sans compte de service (LDAP_DOMAINE renseigné) : connexion directe avec « identifiant@domaine » et le mot de
 *   passe saisi, puis lecture de sa propre fiche dans l'annuaire ;
 * - avec compte de service (LDAP_BIND_DN renseigné) : le compte de service recherche l'utilisateur, puis une
 *   seconde connexion avec le DN trouvé vérifie le mot de passe.
 * Dans les deux cas c'est l'annuaire qui vérifie le mot de passe ; PGRI ne le stocke jamais.
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
    return Boolean(c.url && c.baseDn && (c.domaine || c.bindDn));
  }

  /** Options TLS : certificat de confiance et nom attendu (lus une seule fois). */
  private tlsOptions?: ConnectionOptions;

  private optionsTls(): ConnectionOptions | undefined {
    const c = this.cfg;
    if (!c.url.startsWith('ldaps')) return undefined;
    if (!this.tlsOptions) {
      this.tlsOptions = {
        rejectUnauthorized: c.verifierCertificat,
        ...(c.certificatCa ? { ca: readFileSync(resolve(c.certificatCa)) } : {}),
        ...(c.nomServeur ? { servername: c.nomServeur } : {}),
      };
    }
    return this.tlsOptions;
  }

  private client(): Client {
    return new Client({ url: this.cfg.url, timeout: 8000, connectTimeout: 8000, tlsOptions: this.optionsTls() });
  }

  /** Personne active (comptes désactivés dans l'AD exclus) dont l'identifiant correspond. */
  private filtre(identifiant: string): string {
    const egal = new EqualityFilter({ attribute: this.cfg.attributLogin, value: identifiant }).toString();
    return `(&(objectClass=user)(objectCategory=person)${egal}(!(userAccountControl:1.2.840.113556.1.4.803:=2)))`;
  }

  async authentifier(saisie: string, motDePasse: string): Promise<ProfilAnnuaire> {
    if (!this.estConfigure()) {
      throw new ServiceUnavailableException("La connexion Active Directory n'est pas configurée sur ce serveur.");
    }
    // Un mot de passe vide ferait une connexion anonyme acceptée par certains annuaires : on la refuse d'emblée.
    const identifiant = extraireIdentifiant(saisie);
    if (!motDePasse || !identifiant) throw new UnauthorizedException('Identifiant ou mot de passe incorrect.');

    const entree = this.cfg.bindDn
      ? await this.viaCompteDeService(identifiant, motDePasse)
      : await this.viaConnexionDirecte(identifiant, motDePasse);
    return this.profil(entree, identifiant);
  }

  /** Mode sans compte de service : bind « identifiant@domaine », puis lecture de sa fiche. */
  private async viaConnexionDirecte(identifiant: string, motDePasse: string): Promise<Record<string, unknown>> {
    const c = this.cfg;
    const client = this.client();
    try {
      await client.bind(`${identifiant}@${c.domaine}`, motDePasse);
      const { searchEntries } = await client.search(c.baseDn, {
        scope: 'sub',
        filter: this.filtre(identifiant),
        attributes: ATTRIBUTS,
        sizeLimit: 2,
      });
      if (searchEntries.length !== 1) throw new UnauthorizedException('Identifiant ou mot de passe incorrect.');
      return searchEntries[0];
    } catch (e) {
      throw this.traduireErreur(e);
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  /** Mode avec compte de service : recherche du DN, puis vérification du mot de passe par un second bind. */
  private async viaCompteDeService(identifiant: string, motDePasse: string): Promise<Record<string, unknown>> {
    const c = this.cfg;
    const recherche = this.client();
    let entree: Record<string, unknown> | undefined;
    try {
      await recherche.bind(c.bindDn, c.bindPassword);
      const { searchEntries } = await recherche.search(c.baseDn, {
        scope: 'sub',
        filter: this.filtre(identifiant),
        attributes: ATTRIBUTS,
        sizeLimit: 2,
      });
      entree = searchEntries.length === 1 ? searchEntries[0] : undefined;
    } catch (e) {
      throw this.traduireErreur(e);
    } finally {
      await recherche.unbind().catch(() => undefined);
    }
    if (!entree) throw new UnauthorizedException('Identifiant ou mot de passe incorrect.');

    const verification = this.client();
    try {
      await verification.bind(String(entree.dn), motDePasse);
      return entree;
    } catch (e) {
      throw this.traduireErreur(e);
    } finally {
      await verification.unbind().catch(() => undefined);
    }
  }

  private traduireErreur(e: unknown): Error {
    if (e instanceof UnauthorizedException) return e;
    // Mot de passe faux, compte désactivé, verrouillé ou expiré : l'AD répond « invalidCredentials »
    if (e instanceof InvalidCredentialsError) return new UnauthorizedException('Identifiant ou mot de passe incorrect.');
    this.log.error(`Erreur LDAP : ${(e as Error).message}`);
    return new ServiceUnavailableException(
      "L'annuaire Active Directory est injoignable. Réessayez ou utilisez un compte local.",
    );
  }

  private profil(entree: Record<string, unknown>, identifiant: string): ProfilAnnuaire {
    const c = this.cfg;
    const dnGroupes = (Array.isArray(entree.memberOf) ? entree.memberOf : [entree.memberOf]).filter(Boolean).map(String);
    const groupes = new Set([...dnGroupes.map((g) => g.toLowerCase()), ...dnGroupes.map(cnDuGroupe)]);

    const roles: Role[] = [Role.DEMANDEUR];
    for (const [role, groupe] of Object.entries(c.groupes)) {
      // Le groupe peut être indiqué par son DN complet ou par son seul nom (CN)
      if (groupe && groupes.has(groupe.toLowerCase())) roles.push(role as Role);
    }

    return {
      login: premier(entree[c.attributLogin]) ?? identifiant,
      nomComplet: premier(entree.displayName) ?? premier(entree.cn) ?? identifiant,
      email: premier(entree.mail),
      direction: premier(entree.company) ?? premier(entree.physicalDeliveryOfficeName),
      service: premier(entree.department),
      roles,
    };
  }
}
