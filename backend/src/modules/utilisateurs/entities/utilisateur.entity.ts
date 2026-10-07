import { Check, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Role } from '../../../common/enums/role.enum';
import { SourceCompte } from '../../../common/enums/source-compte.enum';

/**
 * Utilisateur de PGRI (voir Figure 3).
 * - Compte AD : créé ou mis à jour à chaque connexion à partir de l'annuaire ; pas de mot de passe stocké.
 * - Compte local : créé par l'administrateur ; mot de passe stocké chiffré (bcrypt).
 * Les rôles sont stockés en liste simple pour l'instant (l'entité Role du modèle viendra avec la gestion des groupes AD).
 */
@Entity('utilisateur')
@Unique('uq_utilisateur_login_source', ['login', 'source'])
@Check('ck_utilisateur_source', `"source" IN ('AD', 'LOCAL')`)
@Check('ck_utilisateur_mot_de_passe', `"source" = 'AD' OR "mot_de_passe_hash" IS NOT NULL`)
export class Utilisateur {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Identifiant de connexion, en minuscules (sAMAccountName pour l'AD). */
  @Column({ length: 100 })
  login!: string;

  @Column({ type: 'varchar', length: 10 })
  source!: SourceCompte;

  /** Empreinte bcrypt du mot de passe — comptes locaux uniquement, jamais renvoyée par l'API. */
  @Column({ name: 'mot_de_passe_hash', type: 'varchar', length: 100, nullable: true, select: false })
  motDePasseHash!: string | null;

  @Column({ name: 'nom_complet', length: 150 })
  nomComplet!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  direction!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  service!: string | null;

  @Column({ type: 'simple-array', default: Role.DEMANDEUR })
  roles!: Role[];

  @Column({ default: true })
  actif!: boolean;

  @Column({ name: 'derniere_connexion', type: 'timestamptz', nullable: true })
  derniereConnexion!: Date | null;

  @CreateDateColumn({ name: 'cree_le', type: 'timestamptz' })
  creeLe!: Date;

  @UpdateDateColumn({ name: 'modifie_le', type: 'timestamptz' })
  modifieLe!: Date;
}
