import { api } from '@/api/client';

export type EtatTechnique = 'BON' | 'A_SURVEILLER' | 'EN_REPARATION';
export type Disponibilite = 'DISPONIBLE' | 'INDISPONIBLE' | 'HORS_SERVICE';

export interface Vehicule {
  id: string;
  nom: string;
  immatriculation: string;
  marqueModele: string;
  nbPlaces: number;
  kilometrage: number;
  etatTechnique: EtatTechnique;
  actif: boolean;
  disponibilite: Disponibilite;
}

export type VehiculeSaisie = Pick<Vehicule, 'immatriculation' | 'marqueModele' | 'nbPlaces' | 'kilometrage' | 'etatTechnique' | 'actif'>;

export interface Chauffeur {
  id: string;
  nomComplet: string;
  matricule: string;
  telephone: string | null;
  numeroPermis: string | null;
  actif: boolean;
  disponibilite: Disponibilite;
}

export type ChauffeurSaisie = Pick<Chauffeur, 'nomComplet' | 'matricule' | 'telephone' | 'numeroPermis' | 'actif'>;

export const LIBELLE_ETAT: Record<EtatTechnique, string> = {
  BON: 'Bon état',
  A_SURVEILLER: 'À surveiller',
  EN_REPARATION: 'En réparation',
};

export const LIBELLE_DISPONIBILITE: Record<Disponibilite, string> = {
  DISPONIBLE: 'Disponible',
  INDISPONIBLE: 'Indisponible',
  HORS_SERVICE: 'Hors service',
};

export const vehiculesApi = {
  lister: () => api.get<Vehicule[]>('/vehicules').then((r) => r.data),
  creer: (v: VehiculeSaisie) => api.post<Vehicule>('/vehicules', v).then((r) => r.data),
  modifier: (id: string, v: VehiculeSaisie) => api.put<Vehicule>(`/vehicules/${id}`, v).then((r) => r.data),
};

export const chauffeursApi = {
  lister: () => api.get<Chauffeur[]>('/chauffeurs').then((r) => r.data),
  creer: (c: ChauffeurSaisie) => api.post<Chauffeur>('/chauffeurs', c).then((r) => r.data),
  modifier: (id: string, c: ChauffeurSaisie) => api.put<Chauffeur>(`/chauffeurs/${id}`, c).then((r) => r.data),
};
