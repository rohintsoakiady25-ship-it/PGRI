import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

/**
 * Chauffeur affectable aux missions (Figure 3).
 * Distinct de Ressource : c'est une personne affectée à une mission, pas un bien réservable.
 */
@Entity('chauffeur')
@Unique('uq_chauffeur_matricule', ['matricule'])
@Unique('uq_chauffeur_permis', ['numeroPermis'])
export class Chauffeur {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'nom_complet', length: 150 })
  nomComplet!: string;

  /** Matricule du personnel MNP (identifiant RH). */
  @Column({ length: 20 })
  matricule!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  telephone!: string | null;

  @Column({ name: 'numero_permis', type: 'varchar', length: 30, nullable: true })
  numeroPermis!: string | null;

  @Column({ default: true })
  actif!: boolean;

  @CreateDateColumn({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @UpdateDateColumn({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}
