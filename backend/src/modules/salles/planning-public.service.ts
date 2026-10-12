import { randomBytes, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StatutDemande } from '../../common/enums/statut-demande.enum';
import { ParametresService } from '../parametres/parametres.service';
import { Salle } from '../ressources/entities/salle.entity';
import { DemandeSalle } from './entities/demande-salle.entity';

const CLE_JETON = 'planning_salles_jeton_public';
/** Seules les réservations confirmées par la logistique sont publiques (et celles terminées, qui l'avaient été). */
const STATUTS_AFFICHES = [StatutDemande.CONFIRMEE, StatutDemande.TERMINEE];
const UN_MOIS = 31 * 24 * 3600 * 1000;

/**
 * Lien public du planning des salles (affiché par QR code) : consultation sans connexion,
 * protégée par un jeton aléatoire que la logistique peut régénérer pour invalider l'ancien lien.
 */
@Injectable()
export class PlanningPublicService {
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    private readonly parametres: ParametresService,
  ) {}

  /** Jeton actuel, créé au premier appel. */
  async lien() {
    const p = (await this.parametres.lire(CLE_JETON)) ?? (await this.parametres.ecrire(CLE_JETON, this.nouveauJeton()));
    return { jeton: p.valeur, modifieLe: p.modifieLe };
  }

  /** Nouveau jeton : l'ancien lien et l'ancien QR code cessent de fonctionner. */
  async regenerer() {
    const p = await this.parametres.ecrire(CLE_JETON, this.nouveauJeton());
    return { jeton: p.valeur, modifieLe: p.modifieLe };
  }

  /**
   * Planning public : salles et réservations de la période, sans le nom des demandeurs.
   * Les demandes en attente, refusées, annulées ou libérées n'apparaissent pas.
   */
  async planning(jeton: string, du: Date, au: Date) {
    await this.verifier(jeton);
    if (au <= du || au.getTime() - du.getTime() > UN_MOIS) throw new BadRequestException('Période invalide (un mois au plus).');

    const reservations = await this.source
      .getRepository(DemandeSalle)
      .createQueryBuilder('d')
      .where('d.statut IN (:...statuts)', { statuts: STATUTS_AFFICHES })
      .andWhere('d.creneauDebut < :au AND d.creneauFin > :du', { du, au })
      .orderBy('d.creneauDebut', 'ASC')
      .getMany();
    const salles = await this.source.getRepository(Salle).find({ order: { nom: 'ASC' } });
    const maintenant = new Date();

    return {
      salles: salles
        .filter((s) => s.actif || reservations.some((r) => r.salleId === s.id))
        .map((s) => ({ id: s.id, nom: s.nom, capacite: s.capacite, actif: s.actif })),
      reservations: reservations.map((r) => ({
        id: r.id,
        salleId: r.salleId,
        debut: r.creneauDebut,
        fin: r.creneauFin,
        // Une réservation confirmée dont le créneau est passé s'affiche comme terminée
        statut: r.statut === StatutDemande.CONFIRMEE && r.creneauFin <= maintenant ? StatutDemande.TERMINEE : r.statut,
        objet: r.objet,
      })),
    };
  }

  /** Comparaison à temps constant : la durée de la réponse ne renseigne pas sur le jeton. */
  private async verifier(jeton: string) {
    const attendu = (await this.parametres.lire(CLE_JETON))?.valeur;
    const a = Buffer.from(jeton ?? '');
    const b = Buffer.from(attendu ?? '');
    if (!attendu || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new NotFoundException("Ce lien n'est plus valide. Demandez le nouveau QR code au responsable logistique.");
    }
  }

  private nouveauJeton() {
    return randomBytes(24).toString('base64url'); // 32 caractères, 192 bits
  }
}
