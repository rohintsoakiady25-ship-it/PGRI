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
