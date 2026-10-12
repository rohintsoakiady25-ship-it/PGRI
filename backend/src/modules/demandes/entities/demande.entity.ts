import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, TableInheritance, Unique, UpdateDateColumn,
} from 'typeorm';
import { StatutDemande } from '../../../common/enums/statut-demande.enum';
import { Utilisateur } from '../../utilisateurs/entities/utilisateur.entity';
import { Commentaire } from './commentaire.entity';
import { HistoriqueStatut } from './historique-statut.entity';
import { Validation } from './validation.entity';

/**
 * Demande (Figure 3) : classe abstraite. Héritage « table unique » : les trois types de demande
 * partagent la table « demande », distingués par la colonne « type » (DEPLACEMENT, SALLE, FOURNITURE).
 */
@Entity('demande')
@TableInheritance({ column: { type: 'varchar', name: 'type', length: 20 } })
@Unique('uq_demande_reference', ['reference'])
export abstract class Demande {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Référence lisible, ex. SAL-2026-0001. */
  @Column({ length: 20 })
  reference!: string;

  @Column({ type: 'varchar', length: 30, default: StatutDemande.BROUILLON })
  statut!: StatutDemande;

  @ManyToOne(() => Utilisateur, { nullable: false })
  @JoinColumn({ name: 'demandeur_id' })
  demandeur!: Utilisateur;

  @Column({ name: 'demandeur_id', type: 'uuid' })
  demandeurId!: string;

  @CreateDateColumn({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @Column({ name: 'soumis_le', type: 'timestamptz', nullable: true })
  soumisLe!: Date | null;

  @UpdateDateColumn({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;

  @OneToMany(() => Validation, (v) => v.demande)
  validations!: Validation[];

  @OneToMany(() => Commentaire, (c) => c.demande)
  commentaires!: Commentaire[];

  @OneToMany(() => HistoriqueStatut, (h) => h.demande)
  historique!: HistoriqueStatut[];
}
