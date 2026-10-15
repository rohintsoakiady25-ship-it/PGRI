import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Mail {
  to: string | string[];
  subject: string;
  html: string;
}

interface JetonGraph {
  valeur: string;
  /** Instant (ms) après lequel on redemande un jeton. */
  expireA: number;
}

/**
 * Envoi d'e-mails par Microsoft Graph (/users/{expéditeur}/sendMail), avec le jeton
 * « client credentials » de l'application Azure AD. Le jeton est gardé jusqu'à une minute avant expiration.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly tenantId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly expediteur: string;
  private jeton: JetonGraph | null = null;

  constructor(config: ConfigService) {
    this.tenantId = config.get<string>('mail.tenantId') ?? '';
    this.clientId = config.get<string>('mail.clientId') ?? '';
    this.clientSecret = config.get<string>('mail.clientSecret') ?? '';
    this.expediteur = config.get<string>('mail.expediteur') ?? '';
    if (!this.estConfigure()) this.logger.warn('E-mails désactivés : AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET ou MAIL_SENDER_ADDRESS manquant.');
  }

  estConfigure(): boolean {
    return Boolean(this.tenantId && this.clientId && this.clientSecret && this.expediteur);
  }

  async envoyer(mail: Mail): Promise<void> {
    if (!this.estConfigure()) return;
    const destinataires = (Array.isArray(mail.to) ? mail.to : [mail.to]).filter(Boolean);
    if (!destinataires.length) return;
    const corps = {
      message: {
        subject: mail.subject,
        body: { contentType: 'HTML', content: mail.html },
        toRecipients: destinataires.map((address) => ({ emailAddress: { address } })),
      },
      saveToSentItems: true,
    };
    const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.expediteur)}/sendMail`;
    let r = await this.appelGraph(url, corps);
    if (r.status === 401) {
      // Jeton révoqué ou expiré plus tôt que prévu : un nouvel essai avec un jeton neuf
      this.jeton = null;
      r = await this.appelGraph(url, corps);
    }
    if (r.status !== 202) throw new Error(`Graph sendMail ${r.status} : ${(await r.text()).slice(0, 300)}`);
  }

  private async appelGraph(url: string, corps: unknown) {
    return fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${await this.jetonValide()}`, 'content-type': 'application/json' },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(15_000),
    });
  }

  private async jetonValide(): Promise<string> {
    if (this.jeton && Date.now() < this.jeton.expireA) return this.jeton.valeur;
    const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await r.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!r.ok || !j.access_token) throw new Error(`Jeton Azure refusé : ${j.error ?? r.status} ${j.error_description?.split('\r\n')[0] ?? ''}`);
    this.jeton = { valeur: j.access_token, expireA: Date.now() + ((j.expires_in ?? 3600) - 60) * 1000 };
    return this.jeton.valeur;
  }
}
