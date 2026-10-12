import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Utilisateur } from '../../utilisateurs/entities/utilisateur.entity';
import { Demande } from './demande.entity';

/** Avis sur une demande, sans effet sur son statut (N+1, assistante de direction…) — Figure 3. */
@Entity('commentaire')
export class Commentaire {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Demande, (d) => d.commentaires, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'demande_id' })
  demande!: Demande;

  @ManyToOne(() => Utilisateur, { nullable: false })
  @JoinColumn({ name: 'auteur_id' })
  auteur!: Utilisateur;

  @Column({ type: 'text' })
  texte!: string;

  @CreateDateColumn({ name: 'cree_le', type: 'timestamptz' })
  date!: Date;
}
