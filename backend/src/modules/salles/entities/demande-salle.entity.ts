import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { TypeDemande } from '../../../common/enums/type-demande.enum';
import { Demande } from '../../demandes/entities/demande.entity';
import { Salle } from '../../ressources/entities/salle.entity';

/**
 * Réservation de salle (Figure 3, section 4.1.3), dans la table « demande » (type = SALLE).
 * Héritage « table unique » : les colonnes propres aux salles sont facultatives en base ;
 * leur présence est garantie par la validation de l'API.
 */
@ChildEntity(TypeDemande.SALLE)
export class DemandeSalle extends Demande {
  @ManyToOne(() => Salle, { nullable: true })
  @JoinColumn({ name: 'salle_id' })
  salle!: Salle;

  @Column({ name: 'salle_id', type: 'uuid', nullable: true })
  salleId!: string;

  @Column({ name: 'creneau_debut', type: 'timestamptz', nullable: true })
  creneauDebut!: Date;

  @Column({ name: 'creneau_fin', type: 'timestamptz', nullable: true })
  creneauFin!: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  objet!: string;

  @Column({ name: 'nb_participants', type: 'smallint', nullable: true })
  nbParticipants!: number;

  @Column({ name: 'equipements_souhaites', type: 'simple-array', nullable: true })
  equipementsSouhaites!: string[] | null;

  /** Liste libre des participants (facultatif). */
  @Column({ type: 'text', nullable: true })
  participants!: string | null;
}
