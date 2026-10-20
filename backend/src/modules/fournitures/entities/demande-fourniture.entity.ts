import { ChildEntity, Column, OneToMany } from 'typeorm';
import { TypeDemande } from '../../../common/enums/type-demande.enum';
import { Demande } from '../../demandes/entities/demande.entity';
import { LigneFourniture } from './ligne-fourniture.entity';

/**
 * Demande de fournitures (Figure 3, section 4.1.4), dans la table « demande » (type = FOURNITURE).
 * Les articles demandés sont des lignes distinctes (LigneFourniture).
 */
@ChildEntity(TypeDemande.FOURNITURE)
export class DemandeFourniture extends Demande {
  /** Date à laquelle le demandeur a besoin des fournitures (facultatif, « AAAA-MM-JJ »). */
  @Column({ name: 'date_besoin', type: 'date', nullable: true })
  dateBesoin!: string | null;

  @Column({ type: 'text', nullable: true })
  observations!: string | null;

  @OneToMany(() => LigneFourniture, (l) => l.demande)
  lignes!: LigneFourniture[];
}
