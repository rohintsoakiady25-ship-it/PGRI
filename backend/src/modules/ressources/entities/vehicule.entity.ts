import { Check, Column, Entity, Unique } from 'typeorm';
import { EtatTechnique } from '../../../common/enums/etat-technique.enum';
import { Ressource } from './ressource.entity';

/** Véhicule de MNP affectable aux déplacements de service (Figure 3). */
@Entity('vehicule')
@Unique('uq_vehicule_immatriculation', ['immatriculation'])
@Check('ck_vehicule_etat', `"etat_technique" IN ('BON', 'A_SURVEILLER', 'EN_REPARATION')`)
@Check('ck_vehicule_places', `"nb_places" BETWEEN 1 AND 60`)
@Check('ck_vehicule_assurance', `"assurance_fin" >= "assurance_debut"`)
@Check('ck_vehicule_visite', `"visite_technique_fin" >= "visite_technique_debut"`)
export class Vehicule extends Ressource {
  /** En majuscules, ex. « 1234 TBA ». */
  @Column({ length: 20 })
  immatriculation!: string;

  /** Facultatif : la liste du parc ne le donne pas toujours. */
  @Column({ name: 'marque_modele', type: 'varchar', length: 100, nullable: true })
  marqueModele!: string | null;

  @Column({ name: 'nb_places', type: 'smallint', nullable: true })
  nbPlaces!: number | null;

  @Column({ name: 'etat_technique', type: 'varchar', length: 20, default: EtatTechnique.BON })
  etatTechnique!: EtatTechnique;

  /** Période couverte par l'assurance (dates « AAAA-MM-JJ »). */
  @Column({ name: 'assurance_debut', type: 'date', nullable: true })
  assuranceDebut!: string | null;

  @Column({ name: 'assurance_fin', type: 'date', nullable: true })
  assuranceFin!: string | null;

  /** Période de validité de la visite technique. */
  @Column({ name: 'visite_technique_debut', type: 'date', nullable: true })
  visiteTechniqueDebut!: string | null;

  @Column({ name: 'visite_technique_fin', type: 'date', nullable: true })
  visiteTechniqueFin!: string | null;
}
