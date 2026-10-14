import { Check, Column, Entity, ManyToMany, Unique } from 'typeorm';
import { Equipement } from './equipement.entity';
import { Ressource } from './ressource.entity';

/** Salle de réunion (Figure 3) : sous-type de Ressource, table concrète « salle ». */
@Entity('salle')
@Unique('uq_salle_nom', ['nom'])
@Check('ck_salle_capacite', '"capacite" BETWEEN 1 AND 500')
export class Salle extends Ressource {
  /** Nombre de places assises. */
  @Column({ type: 'smallint' })
  capacite!: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  localisation!: string | null;

  /** Équipements disponibles dans la salle (gérés depuis la page Équipements). */
  @ManyToMany(() => Equipement, (e) => e.salles, { onDelete: 'CASCADE' })
  equipementsLies!: Equipement[];
}
