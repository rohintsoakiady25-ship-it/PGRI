import { Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Ressource (Figure 3) : classe abstraite, sans table propre.
 * Héritage « tables concrètes » : chaque sous-type (Vehicule, Salle, ArticleStock) a sa table
 * qui reprend ces colonnes ; le type est donné par la table elle-même.
 */
export abstract class Ressource {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Libellé affiché (ex. « Toyota Land Cruiser — 1234 TBA »). */
  @Column({ length: 150 })
  nom!: string;

  @Column({ default: true })
  actif!: boolean;

  @CreateDateColumn({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @UpdateDateColumn({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}
