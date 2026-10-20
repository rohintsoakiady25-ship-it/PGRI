import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ArticleStock } from '../../ressources/entities/article-stock.entity';
import { Utilisateur } from '../../utilisateurs/entities/utilisateur.entity';
import { LigneFourniture } from './ligne-fourniture.entity';

export enum TypeMouvement {
  /** Réception de fournitures au magasin. */
  ENTREE = 'ENTREE',
  /** Remise au demandeur (module fournitures). */
  SORTIE = 'SORTIE',
  /** Correction après comptage (inventaire). */
  AJUSTEMENT = 'AJUSTEMENT',
}

/**
 * Entrée, sortie ou ajustement du stock d'un article (Figure 3).
 * quantite est signée pour un ajustement (écart constaté), positive sinon.
 */
@Entity('mouvement_stock')
@Index('ix_mouvement_stock_article', ['article'])
@Check('ck_mouvement_stock_type', `"type" IN ('ENTREE', 'SORTIE', 'AJUSTEMENT')`)
@Check('ck_mouvement_stock_quantite', `"quantite" <> 0`)
export class MouvementStock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ArticleStock, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'article_id' })
  article!: ArticleStock;

  @Column({ type: 'varchar', length: 12 })
  type!: TypeMouvement;

  @Column({ type: 'integer' })
  quantite!: number;

  @ManyToOne(() => Utilisateur, { nullable: false })
  @JoinColumn({ name: 'auteur_id' })
  auteur!: Utilisateur;

  /** Sortie : ligne de la demande remise (Figure 3, « ligneFourniture 0..1 »). */
  @ManyToOne(() => LigneFourniture, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ligne_fourniture_id' })
  ligneFourniture!: LigneFourniture | null;

  /** Fournisseur ou bon de livraison pour une entrée, motif pour un ajustement. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  observation!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  date!: Date;
}
