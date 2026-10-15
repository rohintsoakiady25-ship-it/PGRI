import { Check, Column, Entity, Unique } from 'typeorm';
import { Ressource } from './ressource.entity';

/**
 * Article du catalogue du magasin (Figure 3) : sous-type de Ressource, table concrète « article_stock ».
 * La désignation est le nom de la ressource ; le stock évolue par mouvements (MouvementStock).
 */
@Entity('article_stock')
@Unique('uq_article_stock_reference', ['reference'])
@Unique('uq_article_stock_nom', ['nom'])
@Check('ck_article_stock_quantite', '"quantite_stock" >= 0')
@Check('ck_article_stock_seuil', '"seuil_alerte" >= 0')
export class ArticleStock extends Ressource {
  /** Attribuée automatiquement (ART-0001, ART-0002…). */
  @Column({ length: 20 })
  reference!: string;

  /** Unité de conditionnement : pièce, paquet, boîte, rame… */
  @Column({ length: 30 })
  unite!: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  categorie!: string | null;

  @Column({ name: 'quantite_stock', type: 'integer', default: 0 })
  quantiteStock!: number;

  /** En dessous ou à ce niveau, l'article est signalé « stock bas ». */
  @Column({ name: 'seuil_alerte', type: 'integer', default: 0 })
  seuilAlerte!: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  fournisseur!: string | null;
}
