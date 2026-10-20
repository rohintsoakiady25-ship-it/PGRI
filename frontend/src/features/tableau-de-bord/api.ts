import { api } from '@/api/client';

/** Indicateurs du tableau de bord pour un mois « AAAA-MM ». */
export interface TableauDeBord {
  mois: string;
  aTraiter: { deplacements: number; salles: number; fournitures: number };
  aujourdhui: { missionsEnCours: number; vehiculesEnMission: number; vehiculesActifs: number; reunions: number };
  alertes: {
    stock: { reference: string; designation: string; unite: string; quantite: number; seuil: number }[];
    echeances: { immatriculation: string; quoi: 'Assurance' | 'Visite technique'; fin: string; expiree: boolean }[];
  };
  demandesParMois: { mois: string; salles: number; deplacements: number; fournitures: number }[];
  vehicules: { immatriculation: string; missions: number; heures: number }[];
  salles: { nom: string; reunions: number; heures: number; heuresOuvrables: number; taux: number }[];
  fournitures: {
    parDirection: { direction: string; demandes: number; articles: number }[];
    topArticles: { designation: string; unite: string; quantite: number }[];
  };
}

export const tableauDeBordApi = {
  lire: (mois: string) => api.get<TableauDeBord>('/tableau-de-bord', { params: { mois } }).then((r) => r.data),
};

const fmtMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const fmtMoisCourt = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

/** « 2026-10 » → « octobre 2026 » */
export const libelleMois = (mois: string) => fmtMois.format(new Date(`${mois}-15T12:00:00`));
/** « 2026-10 » → « oct. » */
export const moisCourt = (mois: string) => fmtMoisCourt.format(new Date(`${mois}-15T12:00:00`));
