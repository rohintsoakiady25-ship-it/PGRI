import { Column, CreateDateColumn, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Salle } from './salle.entity';

/**
 * Matériel des salles de réunion : un enregistrement par appareil (écran, vidéoprojecteur…),
 * identifié par sa référence ; plusieurs appareils peuvent porter le même nom.
 * Rattachement paramétrable : installé dans une seule salle, ou utilisable dans plusieurs salles.
 */
@Entity('equipement')
@Unique('uq_equipement_reference', ['reference'])
export class Equipement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Référence de l'appareil attribuée par la logistique (ex. VP-01), en majuscules. */
  @Column({ length: 30 })
  reference!: string;

  /** Type de matériel, commun à plusieurs appareils (ex. « Vidéoprojecteur »). */
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
