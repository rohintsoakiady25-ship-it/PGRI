import { randomBytes } from 'node:crypto';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { SourceCompte } from '../../common/enums/source-compte.enum';
import { ProfilUtilisateur, UtilisateursService } from '../utilisateurs/utilisateurs.service';
import { Utilisateur } from '../utilisateurs/entities/utilisateur.entity';
import { ConnexionDto } from './dto/connexion.dto';
import { LdapService } from './ldap.service';

/** Contenu du jeton JWT. */
export interface JetonPayload {
  sub: string;
  login: string;
  source: SourceCompte;
  roles: string[];
}

@Injectable()
export class AuthService {
  /** Empreinte bcrypt factice : même temps de calcul qu'un vrai compte quand l'identifiant n'existe pas. */
  private readonly empreinteFactice = bcrypt.hashSync(randomBytes(16).toString('hex'), 12);

  constructor(
    private readonly utilisateurs: UtilisateursService,
    private readonly ldap: LdapService,
    private readonly jwt: JwtService,
  ) {}

  methodesDisponibles() {
    return { ad: this.ldap.estConfigure(), local: true };
  }

  async connecter(dto: ConnexionDto): Promise<{ jeton: string; utilisateur: ProfilUtilisateur }> {
    const identifiant = dto.identifiant.trim();
    const u = dto.methode === 'ad' ? await this.viaAnnuaire(identifiant, dto.motDePasse) : await this.viaCompteLocal(identifiant, dto.motDePasse);

    if (!u.actif) throw new ForbiddenException('Ce compte est désactivé. Contactez la DSII.');
    await this.utilisateurs.noterConnexion(u.id);

    const payload: JetonPayload = { sub: u.id, login: u.login, source: u.source, roles: u.roles };
    return { jeton: await this.jwt.signAsync(payload), utilisateur: this.utilisateurs.profil(u) };
  }

  private async viaAnnuaire(identifiant: string, motDePasse: string): Promise<Utilisateur> {
    const profil = await this.ldap.authentifier(identifiant, motDePasse);
    return this.utilisateurs.enregistrerCompteAd(profil);
  }

  private async viaCompteLocal(identifiant: string, motDePasse: string): Promise<Utilisateur> {
    const u = await this.utilisateurs.trouverLocalAvecMotDePasse(identifiant);
    const valide = await this.utilisateurs.verifierMotDePasse(motDePasse, u?.motDePasseHash ?? this.empreinteFactice);
    // Même message que l'identifiant soit inconnu ou le mot de passe faux
    if (!u || !u.motDePasseHash || !valide) throw new UnauthorizedException('Identifiant ou mot de passe incorrect.');
    return u;
  }

  async profilCourant(id: string): Promise<ProfilUtilisateur> {
    const u = await this.utilisateurs.trouverParId(id);
    if (!u || !u.actif) throw new UnauthorizedException('Session expirée. Reconnectez-vous.');
    return this.utilisateurs.profil(u);
  }
}
