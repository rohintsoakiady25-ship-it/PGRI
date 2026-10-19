import { api } from '@/api/client';

export type EtatTechnique = 'BON' | 'A_SURVEILLER' | 'EN_REPARATION';
export type Disponibilite = 'DISPONIBLE' | 'EN_MISSION' | 'INDISPONIBLE' | 'HORS_SERVICE';

/** Mission en cours ou à venir d'un véhicule ou d'un chauffeur. */
export interface MissionResume {
  debut: string;
  fin: string;
  references: string[];
  destinations: string[];
}

export interface Vehicule {
  id: string;
  nom: string;
  immatriculation: string;
  marqueModele: string | null;
  nbPlaces: number | null;
  etatTechnique: EtatTechnique;
  /** Périodes « AAAA-MM-JJ » (null : non renseignée). */
  assuranceDebut: string | null;
  assuranceFin: string | null;
  visiteTechniqueDebut: string | null;
  visiteTechniqueFin: string | null;
  actif: boolean;
  disponibilite: Disponibilite;
  /** Raison d'une indisponibilité (réparation, assurance ou visite expirée). */
  motif: string | null;
  mission: MissionResume | null;
  prochaineMission: MissionResume | null;
}

export type VehiculeSaisie = Pick<
  Vehicule,
  | 'immatriculation' | 'marqueModele' | 'nbPlaces' | 'etatTechnique' | 'actif'
  | 'assuranceDebut' | 'assuranceFin' | 'visiteTechniqueDebut' | 'visiteTechniqueFin'
>;

/** Échéance d'une assurance ou d'une visite technique, par rapport à aujourd'hui. */
export type Echeance = 'EXPIREE' | 'BIENTOT' | 'VALIDE' | 'NON_RENSEIGNEE';

/** Délai d'alerte avant l'échéance. */
export const JOURS_ALERTE = 30;

export function echeance(fin: string | null, aujourdhui = new Date()): Echeance {
  if (!fin) return 'NON_RENSEIGNEE';
  const jour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const auj = jour(aujourdhui);
  if (fin < auj) return 'EXPIREE';
  const limite = new Date(aujourdhui);
  limite.setDate(limite.getDate() + JOURS_ALERTE);
  return fin <= jour(limite) ? 'BIENTOT' : 'VALIDE';
}

export const LIBELLE_ECHEANCE: Record<Echeance, string> = {
  EXPIREE: 'Expirée',
  BIENTOT: 'À renouveler',
  VALIDE: 'Valide',
  NON_RENSEIGNEE: 'Non renseignée',
};

/** « 2026-10-25 » devient « 25/10/2026 ». */
export const dateCourte = (iso: string) => iso.split('-').reverse().join('/');

export interface Chauffeur {
  id: string;
  nomComplet: string;
  matricule: string;
  telephone: string | null;
  numeroPermis: string | null;
  actif: boolean;
  disponibilite: Disponibilite;
  mission: MissionResume | null;
  prochaineMission: MissionResume | null;
}

export type ChauffeurSaisie = Pick<Chauffeur, 'nomComplet' | 'matricule' | 'telephone' | 'numeroPermis' | 'actif'>;

export const LIBELLE_ETAT: Record<EtatTechnique, string> = {
  BON: 'Bon état',
  A_SURVEILLER: 'À surveiller',
  EN_REPARATION: 'En réparation',
};

export const LIBELLE_DISPONIBILITE: Record<Disponibilite, string> = {
  DISPONIBLE: 'Disponible',
  EN_MISSION: 'En mission',
  INDISPONIBLE: 'Indisponible',
  HORS_SERVICE: 'Hors service',
};

/** Une mission dans la fiche d'un véhicule ou d'un chauffeur. */
export interface MissionFiche {
  id: string;
  statut: 'PREVUE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE';
  debut: string;
  fin: string;
  heureDepartReelle: string | null;
  heureRetourReelle: string | null;
  incidents: string | null;
  vehicule: { immatriculation: string; marqueModele: string | null };
  chauffeur: { nomComplet: string; telephone: string | null };
  demandes: { id: string; reference: string; statut: string; demandeur: string; lieuDepart: string; destination: string; motif: string }[];
}

export interface MissionsFiche {
  aVenir: MissionFiche[];
  historique: MissionFiche[];
}

export const vehiculesApi = {
  lister: () => api.get<Vehicule[]>('/vehicules').then((r) => r.data),
  creer: (v: VehiculeSaisie) => api.post<Vehicule>('/vehicules', v).then((r) => r.data),
  modifier: (id: string, v: VehiculeSaisie) => api.put<Vehicule>(`/vehicules/${id}`, v).then((r) => r.data),
  supprimer: (id: string) => api.delete(`/vehicules/${id}`).then(() => undefined),
  missions: (id: string) => api.get<MissionsFiche>(`/vehicules/${id}/missions`).then((r) => r.data),
};

export const chauffeursApi = {
  lister: () => api.get<Chauffeur[]>('/chauffeurs').then((r) => r.data),
  creer: (c: ChauffeurSaisie) => api.post<Chauffeur>('/chauffeurs', c).then((r) => r.data),
  modifier: (id: string, c: ChauffeurSaisie) => api.put<Chauffeur>(`/chauffeurs/${id}`, c).then((r) => r.data),
  supprimer: (id: string) => api.delete(`/chauffeurs/${id}`).then(() => undefined),
  missions: (id: string) => api.get<MissionsFiche>(`/chauffeurs/${id}/missions`).then((r) => r.data),
};
