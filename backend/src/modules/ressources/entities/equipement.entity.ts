import { Column, CreateDateColumn, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Salle } from './salle.entity';

/**
 * Matériel des salles de réunion (écran, vidéoprojecteur, tableau blanc…).
 * Rattachement paramétrable : installé dans une seule salle, ou utilisable dans plusieurs salles.
 */
@Entity('equipement')
@Unique('uq_equipement_nom', ['nom'])
export class Equipement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  nom!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  /** false : rattaché à une seule salle ; true : peut être dans plusieurs salles. */
  @Column({ name: 'plusieurs_salles', default: false })
  plusieursSalles!: boolean;

  @Column({ default: true })
  actif!: boolean;

  @ManyToMany(() => Salle, (s) => s.equipementsLies)
  @JoinTable({
    name: 'equipement_salle',
    joinColumn: { name: 'equipement_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'salle_id', referencedColumnName: 'id' },
  })
  salles!: Salle[];

  @CreateDateColumn({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @UpdateDateColumn({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}
