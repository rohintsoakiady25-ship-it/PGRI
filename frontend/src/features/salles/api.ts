import { api } from '@/api/client';
import type { TonBadge } from '@/components/common/Badge';

// ---------------------------------------------------------------- salles (référentiel)

export interface Salle {
  id: string;
  nom: string;
  capacite: number;
  equipements: string[];
  localisation: string | null;
  actif: boolean;
}

export type SalleSaisie = Omit<Salle, 'id'>;

export const sallesApi = {
  /** Salles en service, pour réserver (tous les utilisateurs). */
  disponibles: () => api.get<Salle[]>('/salles/disponibles').then((r) => r.data),
  /** Liste complète (logistique, administrateur). */
  lister: () => api.get<Salle[]>('/salles').then((r) => r.data),
  creer: (s: SalleSaisie) => api.post<Salle>('/salles', s).then((r) => r.data),
  modifier: (id: string, s: SalleSaisie) => api.put<Salle>(`/salles/${id}`, s).then((r) => r.data),
  supprimer: (id: string) => api.delete(`/salles/${id}`).then(() => undefined),
};

// ---------------------------------------------------------------- réservations

export type StatutSalle = 'EN_ATTENTE_LOGISTIQUE' | 'CONFIRMEE' | 'REFUSEE' | 'ANNULEE' | 'LIBEREE' | 'TERMINEE';

export const LIBELLE_STATUT: Record<StatutSalle, string> = {
  EN_ATTENTE_LOGISTIQUE: 'En attente logistique',
  CONFIRMEE: 'Confirmée',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
  LIBEREE: 'Libérée',
  TERMINEE: 'Terminée',
};

export const TON_STATUT: Record<StatutSalle, TonBadge> = {
  EN_ATTENTE_LOGISTIQUE: 'attention',
  CONFIRMEE: 'succes',
  REFUSEE: 'danger',
  ANNULEE: 'neutre',
  LIBEREE: 'neutre',
  TERMINEE: 'neutre',
};

export interface PersonneResume {
  id: string;
  nomComplet: string;
}

export interface DemandeSalle {
  id: string;
  reference: string;
  statut: StatutSalle;
  salle: { id: string; nom: string; capacite: number };
  creneauDebut: string;
  creneauFin: string;
  objet: string;
  nbParticipants: number;
  equipementsSouhaites: string[];
  participants: string | null;
  soumisLe: string | null;
  demandeur: PersonneResume & { direction: string | null; service: string | null };
  nbCommentaires: number;
  /** Actions permises à l'utilisateur connecté (calculées par l'API). */
  actions: { decider: boolean; annuler: boolean };
}

export interface DetailDemandeSalle extends DemandeSalle {
  validations: { niveau: string; decision: 'VALIDEE' | 'REFUSEE'; date: string; validateur: PersonneResume | null; commentaire: string | null }[];
  commentaires: { id: string; texte: string; date: string; auteur: PersonneResume | null }[];
  historique: { ancienStatut: StatutSalle | null; nouveauStatut: StatutSalle; date: string; auteur: PersonneResume | null; commentaire: string | null }[];
}

export interface DemandeSalleSaisie {
  salleId: string;
  debut: string;
  fin: string;
  objet: string;
  nbParticipants: number;
  equipementsSouhaites: string[];
  participants: string | null;
}

/** Créneau occupé dans le planning (l'objet n'est fourni qu'à ceux qui peuvent voir la demande). */
export interface Occupation {
  id: string;
  salleId: string;
  debut: string;
  fin: string;
  statut: StatutSalle;
  moi: boolean;
  objet: string | null;
}

export interface Disponibilite {
  salles: {
    salle: { id: string; nom: string; capacite: number; equipements: string[] };
    libre: boolean;
    capaciteSuffisante: boolean;
    conflits: { debut: string; fin: string }[];
  }[];
  /** Prochain créneau libre de même durée dans la salle choisie, si elle est prise. */
  autreCreneau: { debut: string; fin: string } | null;
}

export const demandesSalleApi = {
  planning: (du: string, au: string) => api.get<Occupation[]>('/demandes-salle/planning', { params: { du, au } }).then((r) => r.data),
  disponibilite: (p: { salleId?: string; debut: string; fin: string; nbParticipants?: number }) =>
    api.get<Disponibilite>('/demandes-salle/disponibilite', { params: p }).then((r) => r.data),
  soumettre: (d: DemandeSalleSaisie) => api.post<DetailDemandeSalle>('/demandes-salle', d).then((r) => r.data),
  /** Réservations d'une période avec leurs détails (logistique, administrateur). */
  semaine: (du: string, au: string) => api.get<DemandeSalle[]>('/demandes-salle/semaine', { params: { du, au } }).then((r) => r.data),
  mes: () => api.get<DemandeSalle[]>('/demandes-salle/mes').then((r) => r.data),
  aSuivre: () => api.get<DemandeSalle[]>('/demandes-salle').then((r) => r.data),
  detail: (id: string) => api.get<DetailDemandeSalle>(`/demandes-salle/${id}`).then((r) => r.data),
  decider: (id: string, decision: 'VALIDEE' | 'REFUSEE', commentaire: string | null) =>
    api.post<DetailDemandeSalle>(`/demandes-salle/${id}/decision`, { decision, commentaire }).then((r) => r.data),
  annuler: (id: string) => api.post<DetailDemandeSalle>(`/demandes-salle/${id}/annulation`).then((r) => r.data),
  commenter: (id: string, texte: string) =>
    api.post<DetailDemandeSalle>(`/demandes-salle/${id}/commentaires`, { texte }).then((r) => r.data),
};

// ---------------------------------------------------------------- dates (heure locale du navigateur)

const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const fmtDateHeure = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const heure = (iso: string) => fmtHeure.format(new Date(iso)).replace(':', 'h');
export const dateHeure = (iso: string) => fmtDateHeure.format(new Date(iso)).replace(/(\d{2}):(\d{2})/, '$1h$2');
/** « mar. 14 oct., 09h00 – 10h30 » */
export const creneau = (debut: string, fin: string) => `${fmtJour.format(new Date(debut))}, ${heure(debut)} – ${heure(fin)}`;

/** Date (AAAA-MM-JJ) et heure (HH:MM) locales → ISO 8601. */
export const versIso = (jour: string, hhmm: string) => new Date(`${jour}T${hhmm}:00`).toISOString();
/** Minutes depuis minuit, en heure locale. */
export const minutesDe = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
export const hhmmDe = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
