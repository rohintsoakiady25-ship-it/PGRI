import { api } from '@/api/client';
import type { TonBadge } from '@/components/common/Badge';

export type EtatStock = 'RUPTURE' | 'BAS' | 'OK';

/** Article du catalogue du magasin, avec son stock (vue logistique). */
export interface ArticleStock {
  id: string;
  /** Attribuée par l'API (ART-0001…). */
  reference: string;
  designation: string;
  unite: string;
  categorie: string | null;
  quantiteStock: number;
  seuilAlerte: number;
  fournisseur: string | null;
  /** false : retiré du catalogue (n'est plus proposé aux demandeurs). */
  actif: boolean;
  etat: EtatStock;
}

/** Article proposé dans le formulaire de demande. */
export type ArticleCatalogue = Pick<ArticleStock, 'id' | 'reference' | 'designation' | 'unite' | 'categorie'>;

export interface ArticleSaisie {
  designation: string;
  unite: string;
  categorie: string | null;
  seuilAlerte: number;
  fournisseur: string | null;
  actif: boolean;
  /** Stock compté à l'inventaire ; s'il diffère, l'API enregistre un ajustement. */
  stockCompte?: number;
}

/** Ligne de réception : article du catalogue (articleId) ou nouvel article (désignation, unité, catégorie). */
export interface LigneEntree {
  articleId?: string;
  designation?: string;
  unite?: string;
  categorie?: string | null;
  quantite: number;
}

export interface Entree {
  id: string;
  date: string;
  article: { id: string; reference: string; designation: string; unite: string };
  quantite: number;
  observation: string | null;
  auteur: string;
}

export const stockApi = {
  lister: () => api.get<ArticleStock[]>('/articles-stock').then((r) => r.data),
  catalogue: () => api.get<ArticleCatalogue[]>('/articles-stock/catalogue').then((r) => r.data),
  entrees: (limite = 15) => api.get<Entree[]>('/articles-stock/entrees', { params: { limite } }).then((r) => r.data),
  entrer: (lignes: LigneEntree[], fournisseur: string | null, observation: string | null) =>
    api.post<ArticleStock[]>('/articles-stock/entrees', { lignes, fournisseur, observation }).then((r) => r.data),
  modifier: (id: string, a: ArticleSaisie) => api.put<ArticleStock>(`/articles-stock/${id}`, a).then((r) => r.data),
  supprimer: (id: string) => api.delete(`/articles-stock/${id}`).then(() => undefined),
};

export const ETAT_STOCK: Record<EtatStock, { libelle: string; ton: TonBadge }> = {
  RUPTURE: { libelle: 'Rupture', ton: 'danger' },
  BAS: { libelle: 'Stock bas', ton: 'attention' },
  OK: { libelle: 'Disponible', ton: 'succes' },
};

/** Unités proposées ; on peut en saisir une autre. */
export const UNITES = ['pièce', 'paquet', 'boîte', 'rame', 'carton', 'sachet', 'rouleau', 'flacon', 'lot', 'litre'];

/** Quantité avec son unité : « 12 paquet(s) » devient « 12 paquets ». */
export const quantiteAvecUnite = (n: number, unite: string) =>
  `${n.toLocaleString('fr-FR')} ${Math.abs(n) > 1 && !/[sxz]$/.test(unite) && !unite.includes(' ') ? `${unite}s` : unite}`;

// ---------------------------------------------------------------- demandes de fournitures

export type StatutFourniture = 'EN_ATTENTE_N1' | 'EN_ATTENTE_LOGISTIQUE' | 'VALIDEE' | 'EN_PREPARATION' | 'REMISE' | 'REFUSEE' | 'ANNULEE';

export const LIBELLE_STATUT_FOURNITURE: Record<StatutFourniture, string> = {
  EN_ATTENTE_N1: 'En attente N+1',
  EN_ATTENTE_LOGISTIQUE: 'En attente logistique',
  VALIDEE: 'Validée (au magasin)',
  EN_PREPARATION: 'En préparation',
  REMISE: 'Remise',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
};

export const TON_STATUT_FOURNITURE: Record<StatutFourniture, TonBadge> = {
  EN_ATTENTE_N1: 'attention',
  EN_ATTENTE_LOGISTIQUE: 'attention',
  VALIDEE: 'succes',
  EN_PREPARATION: 'succes',
  REMISE: 'neutre',
  REFUSEE: 'danger',
  ANNULEE: 'neutre',
};

interface Personne {
  id: string;
  nomComplet: string;
}

export interface DemandeFourniture {
  id: string;
  reference: string;
  statut: StatutFourniture;
  /** « AAAA-MM-JJ » */
  dateBesoin: string | null;
  observations: string | null;
  soumisLe: string | null;
  demandeur: Personne & { direction: string | null; service: string | null };
  lignes: {
    id: string;
    article: { id: string; reference: string; designation: string; unite: string };
    quantiteDemandee: number;
    quantiteLivree: number | null;
    observations: string | null;
    /** Stock actuel de l'article (logistique et magasinier seulement). */
    enStock: number | null;
  }[];
  /** Actions permises à l'utilisateur connecté (calculées par l'API). */
  actions: {
    deciderN1: boolean;
    deciderLogistique: boolean;
    prendreEnCharge: boolean;
    remettre: boolean;
    bonDeSortie: boolean;
    annuler: boolean;
  };
}

export interface DetailDemandeFourniture extends DemandeFourniture {
  validations: { niveau: 'N1' | 'LOGISTIQUE'; decision: 'VALIDEE' | 'REFUSEE'; date: string; validateur: Personne | null; commentaire: string | null }[];
  historique: { ancienStatut: StatutFourniture | null; nouveauStatut: StatutFourniture; date: string; auteur: Personne | null; commentaire: string | null }[];
}

/** Quantité réellement remise pour une ligne, avec le motif d'une livraison partielle. */
export interface LigneRemise {
  ligneId: string;
  quantiteLivree: number;
  observations: string | null;
}

export interface BonDeSortie {
  numero: string;
  dateEmission: string;
  magasinier: string;
  demande: {
    reference: string;
    soumisLe: string | null;
    demandeur: { nomComplet: string; direction: string | null; service: string | null };
    observations: string | null;
  };
  lignes: { reference: string; designation: string; unite: string; quantiteDemandee: number; quantiteLivree: number; observations: string | null }[];
}

export interface DemandeFournitureSaisie {
  lignes: { articleId: string; quantite: number; observations: string | null }[];
  dateBesoin: string | null;
  observations: string | null;
}

export const demandesFournitureApi = {
  soumettre: (d: DemandeFournitureSaisie) => api.post<DetailDemandeFourniture>('/demandes-fourniture', d).then((r) => r.data),
  mes: () => api.get<DemandeFourniture[]>('/demandes-fourniture/mes').then((r) => r.data),
  /** Demandes des collaborateurs (N+1), de la direction (assistante), validées (magasinier) ou toutes (logistique). */
  aSuivre: () => api.get<DemandeFourniture[]>('/demandes-fourniture').then((r) => r.data),
  deciderN1: (id: string, decision: 'VALIDEE' | 'REFUSEE', commentaire: string | null) =>
    api.post<DetailDemandeFourniture>(`/demandes-fourniture/${id}/decision-n1`, { decision, commentaire }).then((r) => r.data),
  deciderLogistique: (id: string, decision: 'VALIDEE' | 'REFUSEE', commentaire: string | null) =>
    api.post<DetailDemandeFourniture>(`/demandes-fourniture/${id}/decision-logistique`, { decision, commentaire }).then((r) => r.data),
  /** Magasin : prise en charge, puis remise avec les quantités livrées. */
  prendreEnCharge: (id: string) => api.post<DetailDemandeFourniture>(`/demandes-fourniture/${id}/preparation`).then((r) => r.data),
  remettre: (id: string, lignes: LigneRemise[]) =>
    api.post<DetailDemandeFourniture>(`/demandes-fourniture/${id}/remise`, { lignes }).then((r) => r.data),
  bonDeSortie: (id: string) => api.get<BonDeSortie>(`/demandes-fourniture/${id}/bon-de-sortie`).then((r) => r.data),
  detail: (id: string) => api.get<DetailDemandeFourniture>(`/demandes-fourniture/${id}`).then((r) => r.data),
  annuler: (id: string) => api.post<DetailDemandeFourniture>(`/demandes-fourniture/${id}/annulation`).then((r) => r.data),
};

/** « 3 rames, 2 boîtes… » : résumé des articles d'une demande. */
export const resumeArticles = (d: Pick<DemandeFourniture, 'lignes'>) =>
  d.lignes.map((l) => `${quantiteAvecUnite(l.quantiteDemandee, l.article.unite)} ${l.article.designation}`).join(', ');
