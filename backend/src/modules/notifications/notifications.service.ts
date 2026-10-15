import { Injectable, Logger } from '@nestjs/common';
import { MailService } from './mail.service';

/** Ce qu'il faut savoir d'une réservation pour prévenir le demandeur. */
export interface DecisionSalleMail {
  reference: string;
  confirmee: boolean;
  demandeur: { nomComplet: string; email: string | null };
  salle: string;
  objet: string;
  creneauDebut: Date;
  creneauFin: Date;
  appareils: { nom: string; reference: string }[];
  commentaire: string | null;
}

const FUSEAU = 'Indian/Antananarivo';

const echapper = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** E-mails automatiques adressés aux demandeurs. Un échec d'envoi est journalisé, sans bloquer la décision. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly mail: MailService) {}

  /** Réservation de salle confirmée ou refusée par le responsable logistique. */
  decisionSalle(d: DecisionSalleMail): void {
    if (!this.mail.estConfigure()) return;
    if (!d.demandeur.email) {
      this.logger.warn(`${d.reference} : ${d.demandeur.nomComplet} n'a pas d'adresse e-mail, aucun message envoyé.`);
      return;
    }
    const jour = new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .format(d.creneauDebut);
    const heure = (x: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' }).format(x);
    const decision = d.confirmee ? 'confirmée' : 'refusée';
    const couleur = d.confirmee ? '#2e7d4f' : '#b3261e';

    const lignes: [string, string][] = [
      ['Référence', d.reference],
      ['Objet', d.objet],
      ['Salle', d.salle],
      ['Date', jour],
      ['Créneau', `${heure(d.creneauDebut)} – ${heure(d.creneauFin)}`],
    ];
    if (d.confirmee && d.appareils.length) lignes.push(['Matériel attribué', d.appareils.map((a) => `${a.nom} (${a.reference})`).join(', ')]);
    if (d.commentaire) lignes.push([d.confirmee ? 'Commentaire' : 'Motif du refus', d.commentaire]);

    const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f6f3ee;font-family:Segoe UI,Arial,sans-serif;color:#2b2118">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e6dfd3">
<tr><td style="padding:20px 24px;border-bottom:3px solid #e07b1a"><strong style="font-size:15px;color:#c0620c">PGRI — Madagascar National Parks</strong></td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px">Bonjour ${echapper(d.demandeur.nomComplet)},</p>
<p style="margin:0 0 20px">Votre réservation de salle a été <strong style="color:${couleur}">${decision}</strong> par le responsable logistique.</p>
<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
${lignes
  .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#7a6a58;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0">${echapper(v)}</td></tr>`)
  .join('\n')}
</table>
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #eee5d8;font-size:12px;color:#7a6a58">Message automatique de la plateforme PGRI (DSII) — merci de ne pas y répondre.</td></tr>
</table></body></html>`;

    // Envoi en arrière-plan : la réponse à la logistique n'attend pas Microsoft Graph
    this.mail
      .envoyer({ to: d.demandeur.email, subject: `Réservation de salle ${decision} — ${d.reference}`, html })
      .then(() => this.logger.log(`${d.reference} : e-mail « ${decision} » envoyé au demandeur.`))
      .catch((e: Error) => this.logger.error(`${d.reference} : e-mail non envoyé (${e.message}).`));
  }
}
