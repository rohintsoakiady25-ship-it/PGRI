import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Role } from '../../common/enums/role.enum';
import { SourceCompte } from '../../common/enums/source-compte.enum';
import { Utilisateur } from './entities/utilisateur.entity';

/** Informations d'un compte AD, lues dans l'annuaire à la connexion. */
export interface ProfilAnnuaire {
  login: string;
  nomComplet: string;
  email: string | null;
  direction: string | null;
  service: string | null;
  /** DN de l'utilisateur et de son supérieur (attribut « manager »). */
  dn: string;
  managerDn: string | null;
  roles: Role[];
}

/** Ce que l'API renvoie d'un utilisateur (jamais le mot de passe). */
export interface ProfilUtilisateur {
  id: string;
  login: string;
  source: SourceCompte;
  nomComplet: string;
  email: string | null;
  direction: string | null;
  service: string | null;
  roles: Role[];
  /** A au moins un collaborateur direct : voit et commente leurs demandes de salle. */
  estSuperieur: boolean;
}

const COUT_BCRYPT = 12;

/** Égalité de DN sans tenir compte de la casse (l'AD ne la respecte pas). */
const memeDn = (dn: string) => Raw((col) => `lower(${col}) = lower(:dn)`, { dn });

@Injectable()
export class UtilisateursService {
  constructor(@InjectRepository(Utilisateur) private readonly depot: Repository<Utilisateur>) {}

  /** Compte local avec son empreinte de mot de passe (pour la vérification uniquement). */
  trouverLocalAvecMotDePasse(login: string): Promise<Utilisateur | null> {
    return this.depot
      .createQueryBuilder('u')
      .addSelect('u.motDePasseHash')
      .where('u.login = :login AND u.source = :source', { login: login.toLowerCase(), source: SourceCompte.LOCAL })
      .getOne();
  }

  trouverParId(id: string): Promise<Utilisateur | null> {
    return this.depot.findOne({ where: { id } });
  }

  /** Crée ou met à jour un compte AD à partir de l'annuaire. Les rôles AD remplacent les précédents. */
  async enregistrerCompteAd(profil: ProfilAnnuaire): Promise<Utilisateur> {
    const login = profil.login.toLowerCase();
    const existant = await this.depot.findOne({ where: { login, source: SourceCompte.AD } });
    const u = existant ?? this.depot.create({ login, source: SourceCompte.AD, actif: true });
    u.nomComplet = profil.nomComplet;
    u.email = profil.email;
    u.direction = profil.direction;
    u.service = profil.service;
    u.roles = profil.roles.length ? profil.roles : [Role.DEMANDEUR];
    u.dnAd = profil.dn;
    u.managerDn = profil.managerDn;
    // Lien vers le N+1 s'il s'est déjà connecté (sinon, établi à sa première connexion, ci-dessous)
    u.superieurDirectId = profil.managerDn
      ? ((await this.depot.findOne({ where: { dnAd: memeDn(profil.managerDn), source: SourceCompte.AD } }))?.id ?? null)
      : null;
    const enregistre = await this.depot.save(u);
    // Collaborateurs déjà connus dont ce compte est le « manager »
    await this.depot.update({ managerDn: memeDn(profil.dn), source: SourceCompte.AD }, { superieurDirectId: enregistre.id });
    return enregistre;
  }

  /** Crée un compte local (mot de passe chiffré avec bcrypt). */
  async creerCompteLocal(donnees: {
    login: string;
    motDePasse: string;
    nomComplet: string;
    email?: string | null;
    roles?: Role[];
  }): Promise<Utilisateur> {
    const u = this.depot.create({
      login: donnees.login.toLowerCase(),
      source: SourceCompte.LOCAL,
      motDePasseHash: await bcrypt.hash(donnees.motDePasse, COUT_BCRYPT),
      nomComplet: donnees.nomComplet,
      email: donnees.email ?? null,
      roles: donnees.roles?.length ? donnees.roles : [Role.DEMANDEUR],
      actif: true,
    });
    return this.depot.save(u);
  }

  verifierMotDePasse(motDePasse: string, empreinte: string): Promise<boolean> {
    return bcrypt.compare(motDePasse, empreinte);
  }

  async noterConnexion(id: string): Promise<void> {
    await this.depot.update({ id }, { derniereConnexion: new Date() });
  }

  async profil(u: Utilisateur): Promise<ProfilUtilisateur> {
    return {
      id: u.id,
      login: u.login,
      source: u.source,
      nomComplet: u.nomComplet,
      email: u.email,
      direction: u.direction,
      service: u.service,
      roles: u.roles,
      estSuperieur: await this.depot.exists({ where: { superieurDirectId: u.id, actif: true } }),
    };
  }
}
