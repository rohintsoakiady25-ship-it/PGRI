import { api } from '@/api/client';
import type { TonBadge } from '@/components/common/Badge';

export type TypeDeplacement = 'VILLE' | 'MISSION';
export type StatutDeplacement = 'EN_ATTENTE_N1' | 'EN_ATTENTE_LOGISTIQUE' | 'VALIDEE' | 'EN_COURS' | 'TERMINEE' | 'REFUSEE' | 'ANNULEE';

export const LIBELLE_STATUT_DEPLACEMENT: Record<StatutDeplacement, string> = {
  EN_ATTENTE_N1: 'En attente N+1',
  EN_ATTENTE_LOGISTIQUE: 'En attente logistique',
  VALIDEE: 'Validée',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
};

export const TON_STATUT_DEPLACEMENT: Record<StatutDeplacement, TonBadge> = {
  EN_ATTENTE_N1: 'attention',
  EN_ATTENTE_LOGISTIQUE: 'attention',
  VALIDEE: 'succes',
  EN_COURS: 'succes',
  TERMINEE: 'neutre',
  REFUSEE: 'danger',
  ANNULEE: 'neutre',
};

export const LIBELLE_TYPE: Record<TypeDeplacement, string> = { VILLE: 'En ville', MISSION: 'Mission' };

interface Personne {
  id: string;
  nomComplet: string;
}

export interface DemandeDeplacement {
  id: string;
  reference: string;
  statut: StatutDeplacement;
  typeDeplacement: TypeDeplacement;
  motif: string;
  lieuDepart: string;
  depart: { lat: number; lon: number };
  destination: string;
  arrivee: { lat: number; lon: number };
  distanceEstimeeKm: number | null;
  dateHeureDepart: string;
  dateHeureRetourPrevue: string;
  dureeMissionJours: number | null;
  personnesConcernees: string | null;
  soumisLe: string | null;
  demandeur: Personne & { direction: string | null; service: string | null };
  /** Véhicule et chauffeur affectés par la logistique (partagés si la mission est regroupée). */
  affectation: {
    id: string;
    statut: 'PREVUE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
    debut: string;
    fin: string;
    heureDepartReelle: string | null;
    heureRetourReelle: string | null;
    incidents: string | null;
    vehicule: { immatriculation: string; marqueModele: string | null; nbPlaces: number | null };
    chauffeur: { nomComplet: string; telephone: string | null };
  } | null;
  /** Actions permises à l'utilisateur connecté (calculées par l'API). */
  actions: { deciderN1: boolean; deciderLogistique: boolean; depart: boolean; retour: boolean; annuler: boolean };
}

export interface DetailDemandeDeplacement extends DemandeDeplacement {
  itineraireRetenu: string | null;
  validations: { niveau: 'N1' | 'LOGISTIQUE'; decision: 'VALIDEE' | 'REFUSEE'; date: string; validateur: Personne | null; commentaire: string | null }[];
  commentaires: { id: string; texte: string; date: string; auteur: Personne | null }[];
  historique: { ancienStatut: StatutDeplacement | null; nouveauStatut: StatutDeplacement; date: string; auteur: Personne | null; commentaire: string | null }[];
}

/** Affectation active qui occupe déjà le véhicule ou le chauffeur. */
interface Conflit {
  affectationId: string;
  debut: string;
  fin: string;
  references: string[];
}

/** Véhicules, chauffeurs et missions prévues à partager, sur la période de la demande (logistique). */
export interface OptionsAffectation {
  vehicules: {
    id: string;
    immatriculation: string;
    marqueModele: string | null;
    nbPlaces: number | null;
    libre: boolean;
    /** Raison qui empêche de l'utiliser (assurance ou visite expirée, en réparation…). */
    bloquant: string | null;
    avertissements: string[];
    conflits: Conflit[];
  }[];
  chauffeurs: { id: string; nomComplet: string; telephone: string | null; libre: boolean; conflits: Conflit[] }[];
  regroupements: {
    id: string;
    vehicule: { immatriculation: string; marqueModele: string | null; nbPlaces: number | null };
    chauffeur: { nomComplet: string };
    debut: string;
    fin: string;
    demandes: { reference: string; destination: string }[];
    possible: boolean;
  }[];
}

/** Choix de la logistique : véhicule + chauffeur, ou affectation existante à partager. */
export type ChoixLogistique = { vehiculeId?: string; chauffeurId?: string; affectationId?: string };

export interface DemandeDeplacementSaisie {
  typeDeplacement: TypeDeplacement;
  motif: string;
  lieuDepart: string;
  departLatitude: number;
  departLongitude: number;
  destination: string;
  destinationLatitude: number;
  destinationLongitude: number;
  itineraireRetenu: string | null;
  distanceEstimeeKm: number | null;
  dateHeureDepart: string;
  dateHeureRetourPrevue: string;
  dureeMissionJours: number | null;
  personnesConcernees: string | null;
}

export const demandesDeplacementApi = {
  soumettre: (d: DemandeDeplacementSaisie) => api.post<DetailDemandeDeplacement>('/demandes-deplacement', d).then((r) => r.data),
  mes: () => api.get<DemandeDeplacement[]>('/demandes-deplacement/mes').then((r) => r.data),
  /** Demandes des collaborateurs (N+1), de la direction (assistante) ou toutes (logistique). */
  aSuivre: () => api.get<DemandeDeplacement[]>('/demandes-deplacement').then((r) => r.data),
  detail: (id: string) => api.get<DetailDemandeDeplacement>(`/demandes-deplacement/${id}`).then((r) => r.data),
  annuler: (id: string) => api.post<DetailDemandeDeplacement>(`/demandes-deplacement/${id}/annulation`).then((r) => r.data),
  optionsAffectation: (id: string) => api.get<OptionsAffectation>(`/demandes-deplacement/${id}/affectation-options`).then((r) => r.data),
  deciderLogistique: (id: string, decision: 'VALIDEE' | 'REFUSEE', choix: ChoixLogistique, commentaire: string | null) =>
    api.post<DetailDemandeDeplacement>(`/demandes-deplacement/${id}/decision-logistique`, { decision, commentaire, ...choix }).then((r) => r.data),
  /** Suivi de mission (logistique) : départ, puis retour avec l'heure réelle et les incidents. */
  depart: (id: string) => api.post<DetailDemandeDeplacement>(`/demandes-deplacement/${id}/depart`).then((r) => r.data),
  retour: (id: string, heureRetourReelle: string, incidents: string | null) =>
    api.post<DetailDemandeDeplacement>(`/demandes-deplacement/${id}/retour`, { heureRetourReelle, incidents }).then((r) => r.data),
  deciderN1: (id: string, decision: 'VALIDEE' | 'REFUSEE', commentaire: string | null) =>
    api.post<DetailDemandeDeplacement>(`/demandes-deplacement/${id}/decision-n1`, { decision, commentaire }).then((r) => r.data),
};

const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const heure = (d: Date) => fmtHeure.format(d).replace(':', 'h');
const memeJour = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** « mar. 21 oct., 08h00 – 12h00 » ou « mar. 21 oct., 08h00 → ven. 24 oct., 17h00 ». */
export function periode(depart: string, retour: string) {
  const d = new Date(depart);
  const r = new Date(retour);
  return memeJour(d, r)
    ? `${fmtJour.format(d)}, ${heure(d)} – ${heure(r)}`
    : `${fmtJour.format(d)}, ${heure(d)} → ${fmtJour.format(r)}, ${heure(r)}`;
}
