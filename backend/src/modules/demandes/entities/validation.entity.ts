import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DecisionValidation, NiveauValidation } from '../../../common/enums/validation.enum';
import { Utilisateur } from '../../utilisateurs/entities/utilisateur.entity';
import { Demande } from './demande.entity';

/** Décision d'un validateur sur une demande (Figure 3) : niveau N1 ou LOGISTIQUE. */
@Entity('validation')
export class Validation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Demande, (d) => d.validations, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'demande_id' })
  demande!: Demande;

  @Column({ type: 'varchar', length: 20 })
  niveau!: NiveauValidation;

  @Column({ type: 'varchar', length: 20 })
  decision!: DecisionValidation;

  @ManyToOne(() => Utilisateur, { nullable: false })
  @JoinColumn({ name: 'validateur_id' })
  validateur!: Utilisateur;

  @Column({ type: 'text', nullable: true })
  commentaire!: string | null;

  @CreateDateColumn({ name: 'decide_le', type: 'timestamptz' })
  date!: Date;
}
