import { CreateDateColumn, Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Utilisateur } from '../../utilisateurs/entities/utilisateur.entity';
import { DemandeFourniture } from './demande-fourniture.entity';

/**
 * Bon de sortie numérique (Figure 3) : émis par le magasinier à la remise des fournitures.
 * Une demande remise a un seul bon ; il s'imprime (ou s'enregistre en PDF) depuis la plateforme.
 */
@Entity('bon_de_sortie')
@Unique('uq_bon_de_sortie_numero', ['numero'])
@Unique('uq_bon_de_sortie_demande', ['demande'])
export class BonDeSortie {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** BS-2026-0001 */
  @Column({ length: 20 })
  numero!: string;

  @OneToOne(() => DemandeFourniture, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'demande_id' })
  demande!: DemandeFourniture;

  @ManyToOne(() => Utilisateur, { nullable: false })
  @JoinColumn({ name: 'magasinier_id' })
  magasinier!: Utilisateur;

  @CreateDateColumn({ name: 'date_emission', type: 'timestamptz' })
  dateEmission!: Date;
}
