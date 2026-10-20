import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { ArticleStock } from '../../ressources/entities/article-stock.entity';
import { DemandeFourniture } from './demande-fourniture.entity';

/**
 * Un article d'une demande de fournitures (Figure 3) : quantité demandée, puis quantité réellement
 * remise par le magasinier (une livraison partielle est possible, le motif va dans les observations).
 */
@Entity('ligne_fourniture')
@Unique('uq_ligne_fourniture_article', ['demande', 'article'])
@Index('ix_ligne_fourniture_article', ['article'])
@Check('ck_ligne_fourniture_demandee', '"quantite_demandee" > 0')
@Check('ck_ligne_fourniture_livree', '"quantite_livree" >= 0')
export class LigneFourniture {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => DemandeFourniture, (d) => d.lignes, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'demande_id' })
  demande!: DemandeFourniture;

  @ManyToOne(() => ArticleStock, { nullable: false })
  @JoinColumn({ name: 'article_id' })
  article!: ArticleStock;

  @Column({ name: 'quantite_demandee', type: 'integer' })
  quantiteDemandee!: number;

  /** Renseignée à la remise. */
  @Column({ name: 'quantite_livree', type: 'integer', nullable: true })
  quantiteLivree!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  observations!: string | null;

  /** Ordre de saisie, pour réafficher les lignes dans le même ordre. */
  @Column({ type: 'smallint', default: 0 })
  ordre!: number;
}
