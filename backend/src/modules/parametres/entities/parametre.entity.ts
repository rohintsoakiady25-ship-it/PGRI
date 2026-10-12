import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Réglage de la plateforme sous forme clé / valeur (ex. jeton du lien public du planning des salles). */
@Entity('parametre')
export class Parametre {
  @PrimaryColumn({ length: 100 })
  cle!: string;

  @Column({ type: 'text' })
  valeur!: string;

  @UpdateDateColumn({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}
