import { Injectable, Logger } from '@nestjs/common';
import { MailService } from './mail.service';

interface Destinataire {
  nomComplet: string;
  email: string | null;
}

/** Ce qu'il faut savoir d'une réservation pour prévenir le demandeur. */
export interface DecisionSalleMail {
  reference: string;
  confirmee: boolean;
  demandeur: Destinataire;
  salle: string;
  objet: string;
  creneauDebut: Date;
  creneauFin: Date;
  appareils: { nom: string; reference: string }[];
  commentaire: string | null;
}

/** Ce qu'il faut savoir d'une demande de déplacement pour les e-mails. */
export interface DeplacementMail {
  reference: string;
  mission: boolean;
  demandeur: Destinataire & { direction: string | null };
  lieuDepart: string;
  destination: string;
  dateHeureDepart: Date;
  dateHeureRetourPrevue: Date;
  motif: string;
  distanceEstimeeKm: number | null;
}

const FUSEAU = 'Indian/Antananarivo';
const VERT = '#2e7d4f';
const ROUGE = '#b3261e';

const echapper = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const jour = (d: Date) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
const heure = (d: Date) => new Intl.DateTimeFormat('fr-FR', { timeZone: FUSEAU, hour: '2-digit', minute: '2-digit' }).format(d);
const dateHeure = (d: Date) => `${jour(d)} à ${heure(d)}`;

/** E-mails automatiques de la plateforme. Un échec d'envoi est journalisé, sans bloquer l'action qui l'a déclenché. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly mail: MailService) {}

  // ---------------------------------------------------------------- salles

  /** Réservation de salle confirmée ou refusée par le responsable logistique. */
  decisionSalle(d: DecisionSalleMail): void {
    const decision = d.confirmee ? 'confirmée' : 'refusée';
    const lignes: [string, string][] = [
      ['Référence', d.reference],
      ['Objet', d.objet],
      ['Salle', d.salle],
      ['Date', jour(d.creneauDebut)],
      ['Créneau', `${heure(d.creneauDebut)} – ${heure(d.creneauFin)}`],
    ];
    if (d.confirmee && d.appareils.length) lignes.push(['Matériel attribué', d.appareils.map((a) => `${a.nom} (${a.reference})`).join(', ')]);
    if (d.commentaire) lignes.push([d.confirmee ? 'Commentaire' : 'Motif du refus', d.commentaire]);
    this.envoyer(
      d.demandeur,
      `Réservation de salle ${decision} — ${d.reference}`,
      `Votre réservation de salle a été <strong style="color:${d.confirmee ? VERT : ROUGE}">${decision}</strong> par le responsable logistique.`,
      lignes,
      `${d.reference} : e-mail « ${decision} » au demandeur`,
    );
  }

  // ---------------------------------------------------------------- déplacements

  /**
   * Nouvelle demande de déplacement : le N+1 est invité à la valider ;
   * l'assistante de direction de la direction du demandeur en est informée.
   */
  deplacementSoumis(d: DeplacementMail, superieur: Destinataire | null, assistantes: Destinataire[]): void {
    const lignes = this.lignesDeplacement(d, true);
    if (superieur) {
      this.envoyer(
        superieur,
        `Demande de déplacement à valider — ${d.reference}`,
        `${echapper(d.demandeur.nomComplet)} vous soumet une demande de déplacement. Validez-la ou refusez-la dans PGRI, menu Déplacements, « Demandes à valider ».`,
        lignes,
        `${d.reference} : e-mail « à valider » au N+1`,
      );
    }
    for (const a of assistantes) {
      this.envoyer(
        a,
        `Information : demande de déplacement — ${d.reference}`,
        `Pour information, ${echapper(d.demandeur.nomComplet)} (${echapper(d.demandeur.direction ?? 'votre direction')}) a soumis une demande de déplacement.`,
        lignes,
        `${d.reference} : e-mail d'information à l'assistante de direction`,
      );
    }
  }

  /** Décision du supérieur direct : le demandeur est prévenu d'un refus, avec le motif. */
  refusN1Deplacement(d: DeplacementMail, superieur: string, motif: string): void {
    this.envoyer(
      d.demandeur,
      `Demande de déplacement refusée — ${d.reference}`,
      `Votre demande de déplacement a été <strong style="color:${ROUGE}">refusée</strong> par votre supérieur direct (${echapper(superieur)}).`,
      [...this.lignesDeplacement(d, false), ['Motif du refus', motif]],
      `${d.reference} : e-mail « refusée par le N+1 » au demandeur`,
    );
  }

  /** Décision du responsable logistique : véhicule et chauffeur affectés, ou motif du refus. */
  decisionLogistiqueDeplacement(d: DeplacementMail, affectation: { vehicule: string; chauffeur: string } | null, commentaire: string | null): void {
    const valide = affectation !== null;
    const lignes = this.lignesDeplacement(d, false);
    if (affectation) lignes.push(['Véhicule', affectation.vehicule], ['Chauffeur', affectation.chauffeur]);
    if (commentaire) lignes.push([valide ? 'Commentaire' : 'Motif du refus', commentaire]);
    this.envoyer(
      d.demandeur,
      `Demande de déplacement ${valide ? 'validée' : 'refusée'} — ${d.reference}`,
      valide
        ? `Votre demande de déplacement a été <strong style="color:${VERT}">validée</strong> par le responsable logistique. Voici le véhicule et le chauffeur affectés.`
        : `Votre demande de déplacement a été <strong style="color:${ROUGE}">refusée</strong> par le responsable logistique.`,
      lignes,
      `${d.reference} : e-mail « ${valide ? 'validée' : 'refusée'} par la logistique » au demandeur`,
    );
  }

  private lignesDeplacement(d: DeplacementMail, avecDemandeur: boolean): [string, string][] {
    const km = d.distanceEstimeeKm !== null ? ` (environ ${d.distanceEstimeeKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km)` : '';
    return [
      ['Référence', d.reference],
      ...(avecDemandeur ? [['Demandeur', d.demandeur.nomComplet] as [string, string]] : []),
      ['Type', d.mission ? 'Mission' : 'Déplacement en ville'],
      ['Trajet', `${d.lieuDepart} → ${d.destination}${km}`],
      ['Départ', dateHeure(d.dateHeureDepart)],
      ['Retour prévu', dateHeure(d.dateHeureRetourPrevue)],
      ['Motif', d.motif],
    ];
  }

  // ---------------------------------------------------------------- envoi

  /** Met en forme et envoie en arrière-plan : l'utilisateur n'attend pas Microsoft Graph. */
  private envoyer(a: Destinataire, sujet: string, phraseHtml: string, lignes: [string, string][], journal: string): void {
    if (!this.mail.estConfigure()) return;
    if (!a.email) {
      this.logger.warn(`${journal} : ${a.nomComplet} n'a pas d'adresse e-mail, aucun message envoyé.`);
      return;
    }
    const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f6f3ee;font-family:Segoe UI,Arial,sans-serif;color:#2b2118">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e6dfd3">
<tr><td style="padding:20px 24px;border-bottom:3px solid #e07b1a"><strong style="font-size:15px;color:#c0620c">PGRI — Madagascar National Parks</strong></td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px">Bonjour ${echapper(a.nomComplet)},</p>
<p style="margin:0 0 20px">${phraseHtml}</p>
<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">
${lignes
  .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#7a6a58;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0">${echapper(v)}</td></tr>`)
  .join('\n')}
</table>
</td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #eee5d8;font-size:12px;color:#7a6a58">Message automatique de la plateforme PGRI (DSII) — merci de ne pas y répondre.</td></tr>
</table></body></html>`;
    this.mail
      .envoyer({ to: a.email, subject: sujet, html })
      .then(() => this.logger.log(`${journal} : envoyé.`))
      .catch((e: Error) => this.logger.error(`${journal} : non envoyé (${e.message}).`));
  }
}
