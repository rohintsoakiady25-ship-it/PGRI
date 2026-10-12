import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StatutDemande } from '../../../common/enums/statut-demande.enum';
import { Utilisateur } from '../../utilisateurs/entities/utilisateur.entity';
import { Demande } from './demande.entity';

/** Trace de chaque changement de statut (Figure 3). Auteur vide : transition automatique (ex. fin du créneau). */
@Entity('historique_statut')
export class HistoriqueStatut {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Demande, (d) => d.historique, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'demande_id' })
  demande!: Demande;

  @Column({ name: 'ancien_statut', type: 'varchar', length: 30, nullable: true })
  ancienStatut!: StatutDemande | null;

  @Column({ name: 'nouveau_statut', type: 'varchar', length: 30 })
  nouveauStatut!: StatutDemande;

  @ManyToOne(() => Utilisateur, { nullable: true })
  @JoinColumn({ name: 'auteur_id' })
  auteur!: Utilisateur | null;

  @Column({ type: 'text', nullable: true })
  commentaire!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  date!: Date;
}
