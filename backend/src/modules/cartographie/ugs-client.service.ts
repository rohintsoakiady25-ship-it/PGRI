import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface Jeton {
  valeur: string;
  /** Instant (ms) à partir duquel on redemande un jeton (60 s avant l'expiration annoncée). */
  renouvelerA: number;
}

/** Erreur d'appel à mnp-ugs-api ; `statut` = code HTTP reçu (0 : pas de réponse). */
export class ErreurUgs extends Error {
  constructor(message: string, readonly statut: number) {
    super(message);
  }
}

const TENTATIVES = 4;
const DELAI_JETON_MS = 10_000;
const DELAI_APPEL_MS = 15_000;
/** Après un refus des identifiants (invalid_client), pause avant de redemander un jeton. */
const PAUSE_IDENTIFIANTS_MS = 5 * 60_000;

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Client de l'API mnp-ugs-api de la DSII, selon son guide d'intégration :
 * - jeton OAuth 2.0 « client credentials » (en-tête Basic), gardé en mémoire et renouvelé 60 s avant expiration,
 *   un seul renouvellement à la fois ;
 * - sur 401 : un seul rejeu avec un jeton neuf ; 429 et 5xx : réessais avec délai croissant (Retry-After respecté) ;
 *   400, 403, 404 et invalid_client : jamais réessayés ;
 * - ni le secret, ni le jeton, ni l'en-tête Authorization ne sont journalisés.
 * Lecture seule (GET) : c'est tout ce que l'API ouvre aux applications.
 */
@Injectable()
export class UgsClientService {
  private readonly logger = new Logger(UgsClientService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly scope: string;
  private jeton: Jeton | null = null;
  private renouvellement: Promise<Jeton> | null = null;
  private identifiantsRefusesJusqua = 0;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('ugs.baseUrl') ?? '';
    this.clientId = config.get<string>('ugs.clientId') ?? '';
    this.clientSecret = config.get<string>('ugs.clientSecret') ?? '';
    this.scope = (config.get<string>('ugs.scope') ?? '').trim();
    if (!this.estConfigure()) {
      this.logger.warn('Référentiel MNP (mnp-ugs-api) désactivé : MNP_UGS_BASE_URL, MNP_UGS_CLIENT_ID ou MNP_UGS_CLIENT_SECRET manquant.');
    } else if (!this.adresseSure()) {
      this.logger.error('MNP_UGS_BASE_URL doit être en HTTPS (seul localhost est toléré en HTTP pour les essais) : référentiel désactivé.');
    }
  }

  estConfigure(): boolean {
    return Boolean(this.baseUrl && this.clientId && this.clientSecret);
  }

  /** HTTPS obligatoire (vérification TLS active) ; HTTP accepté uniquement vers la machine locale. */
  private adresseSure(): boolean {
    try {
      const u = new URL(this.baseUrl);
      return u.protocol === 'https:' || (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname));
    } catch {
      return false;
    }
  }

  estDisponible(): boolean {
    return this.estConfigure() && this.adresseSure();
  }

  /** GET sur un chemin de l'API (ex. « /protected-areas »), réponse JSON. */
  async lire<T>(chemin: string): Promise<T> {
    if (!this.estDisponible()) throw new ErreurUgs('Référentiel MNP non configuré', 0);
    let jetonNeuf = false;
    for (let tentative = 0; tentative < TENTATIVES; tentative++) {
      let r: Response;
      try {
        r = await fetch(`${this.baseUrl}${chemin}`, {
          headers: { authorization: `Bearer ${await this.jetonValide(jetonNeuf)}`, accept: 'application/json' },
          signal: AbortSignal.timeout(DELAI_APPEL_MS),
        });
      } catch (e) {
        if (e instanceof ErreurUgs) throw e;
        // Panne réseau ou délai dépassé : même traitement qu'une erreur serveur
        if (tentative === TENTATIVES - 1) throw new ErreurUgs(`mnp-ugs-api injoignable (${(e as Error).name})`, 0);
        await attendre(this.delai(tentative, null));
        continue;
      }
      jetonNeuf = false;
      if (r.ok) return (await r.json()) as T;
      if (r.status === 401 && tentative === 0) {
        jetonNeuf = true; // un seul rejeu avec un jeton neuf
        continue;
      }
      if (r.status === 429 || r.status >= 500) {
        await attendre(this.delai(tentative, r.headers.get('retry-after')));
        continue;
      }
      throw new ErreurUgs(`mnp-ugs-api ${chemin.split('/')[1] ?? ''} : statut ${r.status}`, r.status);
    }
    throw new ErreurUgs('mnp-ugs-api indisponible après plusieurs tentatives', 503);
  }

  /** Retry-After s'il est donné, sinon 1, 2, 4… secondes avec une part aléatoire. */
  private delai(tentative: number, retryAfter: string | null): number {
    const secondes = Number(retryAfter);
    if (secondes > 0) return Math.min(secondes, 60) * 1000;
    return 2 ** tentative * 1000 + Math.random() * 250;
  }

  private async jetonValide(forcer: boolean): Promise<string> {
    if (!forcer && this.jeton && Date.now() < this.jeton.renouvelerA) return this.jeton.valeur;
    // Plusieurs requêtes simultanées partagent le même renouvellement
    this.renouvellement ??= this.demanderJeton().finally(() => (this.renouvellement = null));
    this.jeton = await this.renouvellement;
    return this.jeton.valeur;
  }

  private async demanderJeton(): Promise<Jeton> {
    if (Date.now() < this.identifiantsRefusesJusqua) {
      throw new ErreurUgs('Identifiants mnp-ugs-api refusés récemment : nouvel essai plus tard', 401);
    }
    const corps = new URLSearchParams({ grant_type: 'client_credentials' });
    if (this.scope) corps.set('scope', this.scope);
    let r: Response;
    try {
      r = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: corps,
        signal: AbortSignal.timeout(DELAI_JETON_MS),
      });
    } catch (e) {
      throw new ErreurUgs(`Demande de jeton mnp-ugs-api impossible (${(e as Error).name})`, 0);
    }
    const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; scope?: string; error?: string };
    if (!r.ok || !j.access_token) {
      if (j.error === 'invalid_client') {
        // Secret faux, révoqué ou application suspendue : ne pas insister, prévenir l'exploitant
        this.identifiantsRefusesJusqua = Date.now() + PAUSE_IDENTIFIANTS_MS;
        this.logger.error('mnp-ugs-api : identifiants refusés (invalid_client). Vérifier MNP_UGS_CLIENT_SECRET (préfixe mnp_sk_) puis contacter la DSII.');
      } else {
        this.logger.error(`mnp-ugs-api : jeton refusé (${r.status} ${j.error ?? ''}).`);
      }
      throw new ErreurUgs(`Jeton mnp-ugs-api refusé : ${j.error ?? r.status}`, r.status);
    }
    const duree = j.expires_in && j.expires_in > 0 ? j.expires_in : 900;
    this.logger.log(`mnp-ugs-api : nouveau jeton (scopes : ${j.scope ?? 'non précisés'}).`);
    return { valeur: j.access_token, renouvelerA: Date.now() + Math.max(duree - 60, 30) * 1000 };
  }
}
