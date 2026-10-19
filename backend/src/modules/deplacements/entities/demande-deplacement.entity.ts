import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { TypeDemande, TypeDeplacement } from '../../../common/enums/type-demande.enum';
import { Demande } from '../../demandes/entities/demande.entity';
import { Affectation } from './affectation.entity';

/**
 * Demande de déplacement (Figure 3, section 4.1.2), dans la table « demande » (type = DEPLACEMENT).
 * Héritage « table unique » : les colonnes propres aux déplacements sont facultatives en base ;
 * leur présence est garantie par la validation de l'API.
 */
@ChildEntity(TypeDemande.DEPLACEMENT)
export class DemandeDeplacement extends Demande {
  /** VILLE : aller-retour dans la journée ; MISSION : en province, sur plusieurs jours. */
  @Column({ name: 'type_deplacement', type: 'varchar', length: 10, nullable: true })
  typeDeplacement!: TypeDeplacement;

  @Column({ type: 'text', nullable: true })
  motif!: string;

  @Column({ name: 'lieu_depart', type: 'varchar', length: 200, nullable: true })
  lieuDepart!: string;

  @Column({ name: 'depart_latitude', type: 'double precision', nullable: true })
  departLatitude!: number;

  @Column({ name: 'depart_longitude', type: 'double precision', nullable: true })
  departLongitude!: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  destination!: string;

  @Column({ name: 'destination_latitude', type: 'double precision', nullable: true })
  destinationLatitude!: number;

  @Column({ name: 'destination_longitude', type: 'double precision', nullable: true })
  destinationLongitude!: number;

  /** Tracé choisi sur la carte (polyligne encodée) ; absent si aucun itinéraire routier n'a été trouvé. */
  @Column({ name: 'itineraire_retenu', type: 'text', nullable: true })
  itineraireRetenu!: string | null;

  @Column({ name: 'distance_estimee_km', type: 'double precision', nullable: true })
  distanceEstimeeKm!: number | null;

  @Column({ name: 'date_heure_depart', type: 'timestamptz', nullable: true })
  dateHeureDepart!: Date;

  @Column({ name: 'date_heure_retour_prevue', type: 'timestamptz', nullable: true })
  dateHeureRetourPrevue!: Date;

  /** Mission seulement. */
  @Column({ name: 'duree_mission_jours', type: 'smallint', nullable: true })
  dureeMissionJours!: number | null;

  /** Personnes qui voyagent avec le demandeur (facultatif, une par ligne). */
  @Column({ name: 'personnes_concernees', type: 'text', nullable: true })
  personnesConcernees!: string | null;

  /** Véhicule et chauffeur choisis par la logistique (partagés si plusieurs demandes sont regroupées). */
  @ManyToOne(() => Affectation, (a) => a.demandes, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'affectation_id' })
  affectation!: Affectation | null;

  @Column({ name: 'affectation_id', type: 'uuid', nullable: true })
  affectationId!: string | null;
}
