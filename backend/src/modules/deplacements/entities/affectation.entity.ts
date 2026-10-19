import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Chauffeur } from '../../chauffeurs/entities/chauffeur.entity';
import { Vehicule } from '../../ressources/entities/vehicule.entity';
import { Utilisateur } from '../../utilisateurs/entities/utilisateur.entity';
import { DemandeDeplacement } from './demande-deplacement.entity';

export enum StatutAffectation {
  PREVUE = 'PREVUE',
  EN_COURS = 'EN_COURS',
  TERMINEE = 'TERMINEE',
  ANNULEE = 'ANNULEE',
}

/** Statuts qui occupent le véhicule et le chauffeur sur la période. */
export const AFFECTATIONS_ACTIVES = [StatutAffectation.PREVUE, StatutAffectation.EN_COURS];

/**
 * Affectation d'un véhicule et d'un chauffeur sur une période (Figure 3).
 * Une ou plusieurs demandes de déplacement peuvent être servies par la même affectation (regroupement).
 * Conflit : deux affectations actives du même véhicule ou du même chauffeur qui se chevauchent.
 */
@Entity('affectation')
@Index('ix_affectation_vehicule', ['vehicule'])
@Index('ix_affectation_chauffeur', ['chauffeur'])
@Check('ck_affectation_periode', '"date_heure_fin" > "date_heure_debut"')
@Check('ck_affectation_statut', `"statut" IN ('PREVUE', 'EN_COURS', 'TERMINEE', 'ANNULEE')`)
export class Affectation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Vehicule, { nullable: false })
  @JoinColumn({ name: 'vehicule_id' })
  vehicule!: Vehicule;

  @Column({ name: 'vehicule_id', type: 'uuid' })
  vehiculeId!: string;

  @ManyToOne(() => Chauffeur, { nullable: false })
  @JoinColumn({ name: 'chauffeur_id' })
  chauffeur!: Chauffeur;

  @Column({ name: 'chauffeur_id', type: 'uuid' })
  chauffeurId!: string;

  @Column({ name: 'date_heure_debut', type: 'timestamptz' })
  dateHeureDebut!: Date;

  @Column({ name: 'date_heure_fin', type: 'timestamptz' })
  dateHeureFin!: Date;

  @Column({ type: 'varchar', length: 12, default: StatutAffectation.PREVUE })
  statut!: StatutAffectation;

  /** Départ effectif, saisi par la logistique (passage « En cours »). */
  @Column({ name: 'heure_depart_reelle', type: 'timestamptz', nullable: true })
  heureDepartReelle!: Date | null;

  /** Retour effectif et incidents éventuels, saisis par la logistique (passage « Terminée »). */
  @Column({ name: 'heure_retour_reelle', type: 'timestamptz', nullable: true })
  heureRetourReelle!: Date | null;

  @Column({ type: 'text', nullable: true })
  incidents!: string | null;

  @ManyToOne(() => Utilisateur, { nullable: false })
  @JoinColumn({ name: 'affecte_par_id' })
  affectePar!: Utilisateur;

  @OneToMany(() => DemandeDeplacement, (d) => d.affectation)
  demandes!: DemandeDeplacement[];

  @CreateDateColumn({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;
}
