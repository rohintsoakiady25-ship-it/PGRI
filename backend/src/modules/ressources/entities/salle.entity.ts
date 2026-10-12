import { Check, Column, Entity, Unique } from 'typeorm';
import { Ressource } from './ressource.entity';

/** Salle de réunion (Figure 3) : sous-type de Ressource, table concrète « salle ». */
@Entity('salle')
@Unique('uq_salle_nom', ['nom'])
@Check('ck_salle_capacite', '"capacite" BETWEEN 1 AND 500')
export class Salle extends Ressource {
  /** Nombre de places assises. */
  @Column({ type: 'smallint' })
  capacite!: number;

  /** Équipements disponibles (ex. Vidéoprojecteur, Visioconférence). */
  @Column({ type: 'simple-array', default: '' })
  equipements!: string[];

  @Column({ type: 'varchar', length: 150, nullable: true })
  localisation!: string | null;
}
