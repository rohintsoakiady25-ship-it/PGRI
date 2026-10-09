import { Check, Column, Entity, Unique } from 'typeorm';
import { EtatTechnique } from '../../../common/enums/etat-technique.enum';
import { Ressource } from './ressource.entity';

/** Véhicule de MNP affectable aux déplacements de service (Figure 3). */
@Entity('vehicule')
@Unique('uq_vehicule_immatriculation', ['immatriculation'])
@Check('ck_vehicule_etat', `"etat_technique" IN ('BON', 'A_SURVEILLER', 'EN_REPARATION')`)
@Check('ck_vehicule_places', `"nb_places" BETWEEN 1 AND 60`)
@Check('ck_vehicule_kilometrage', `"kilometrage" >= 0`)
export class Vehicule extends Ressource {
  /** En majuscules, ex. « 1234 TBA ». */
  @Column({ length: 20 })
  immatriculation!: string;

  @Column({ name: 'marque_modele', length: 100 })
  marqueModele!: string;

  @Column({ name: 'nb_places', type: 'smallint' })
  nbPlaces!: number;

  @Column({ type: 'integer', default: 0 })
  kilometrage!: number;

  @Column({ name: 'etat_technique', type: 'varchar', length: 20, default: EtatTechnique.BON })
  etatTechnique!: EtatTechnique;
}
