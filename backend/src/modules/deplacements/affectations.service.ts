import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { EtatTechnique } from '../../common/enums/etat-technique.enum';
import { Chauffeur } from '../chauffeurs/entities/chauffeur.entity';
import { Vehicule } from '../ressources/entities/vehicule.entity';
import { Affectation, AFFECTATIONS_ACTIVES, StatutAffectation } from './entities/affectation.entity';
import { DemandeDeplacement } from './entities/demande-deplacement.entity';

const FUSEAU = 'Indian/Antananarivo';
const jourLocal = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: FUSEAU }).format(d); // AAAA-MM-JJ
const jourFr = (iso: string) => iso.split('-').reverse().join('/');
const JOURS_ALERTE = 30;

/** Affectation active qui occupe déjà le véhicule ou le chauffeur sur la période. */
export interface Conflit {
  affectationId: string;
  debut: Date;
  fin: Date;
  references: string[];
}

/** Choix de la logistique : une nouvelle affectation, ou le regroupement avec une affectation existante. */
export interface ChoixAffectation {
  vehiculeId?: string;
  chauffeurId?: string;
  affectationId?: string;
}

/**
 * Affectation des véhicules et des chauffeurs : disponibilités, conflits (chevauchement de périodes
 * entre affectations actives du même véhicule ou du même chauffeur) et regroupement de demandes.
 */
@Injectable()
export class AffectationsService {
  constructor(@InjectDataSource() private readonly source: DataSource) {}

  /** Ce qui empêche d'utiliser le véhicule sur la période (null : utilisable). */
  bloquant(v: Vehicule, fin: Date): string | null {
    if (!v.actif) return 'Hors service';
    if (v.etatTechnique === EtatTechnique.EN_REPARATION) return 'En réparation';
    const jourFin = jourLocal(fin);
    if (v.assuranceFin && v.assuranceFin < jourFin) return `Assurance valable jusqu'au ${jourFr(v.assuranceFin)} seulement`;
    if (v.visiteTechniqueFin && v.visiteTechniqueFin < jourFin) return `Visite technique valable jusqu'au ${jourFr(v.visiteTechniqueFin)} seulement`;
    return null;
  }

  /** Points à surveiller, sans bloquer l'affectation. */
  avertissements(v: Vehicule, fin: Date): string[] {
    const liste: string[] = [];
    // Échéance proche après le retour (une échéance avant le retour est déjà bloquante)
    const jourFin = jourLocal(fin);
    const limite = jourLocal(new Date(fin.getTime() + JOURS_ALERTE * 86_400_000));
    const proche = (echeance: string) => echeance >= jourFin && echeance <= limite;
    if (!v.assuranceFin) liste.push('Assurance non renseignée');
    else if (proche(v.assuranceFin)) liste.push(`Assurance à renouveler (${jourFr(v.assuranceFin)})`);
    if (!v.visiteTechniqueFin) liste.push('Visite technique non renseignée');
    else if (proche(v.visiteTechniqueFin)) liste.push(`Visite technique à renouveler (${jourFr(v.visiteTechniqueFin)})`);
    if (v.etatTechnique === EtatTechnique.A_SURVEILLER) liste.push('État technique à surveiller');
    return liste;
  }

  /** Affectations actives du véhicule ou du chauffeur qui chevauchent [debut, fin[. */
  async conflits(
    m: EntityManager,
    cible: { vehiculeId?: string; chauffeurId?: string },
    debut: Date,
    fin: Date,
    sauf?: string,
  ): Promise<Conflit[]> {
    const qb = m
      .getRepository(Affectation)
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.demandes', 'd')
      .where('a.statut IN (:...actives)', { actives: AFFECTATIONS_ACTIVES })
      .andWhere('a.dateHeureDebut < :fin AND a.dateHeureFin > :debut', { debut, fin });
    if (cible.vehiculeId) qb.andWhere('a.vehiculeId = :v', { v: cible.vehiculeId });
    if (cible.chauffeurId) qb.andWhere('a.chauffeurId = :c', { c: cible.chauffeurId });
    if (sauf) qb.andWhere('a.id <> :sauf', { sauf });
    return (await qb.orderBy('a.dateHeureDebut').getMany()).map((a) => ({
      affectationId: a.id,
      debut: a.dateHeureDebut,
      fin: a.dateHeureFin,
      references: (a.demandes ?? []).map((d) => d.reference).sort(),
    }));
  }

  /** Pour la logistique, avant de valider : véhicules, chauffeurs et regroupements possibles sur la période de la demande. */
  async options(d: DemandeDeplacement) {
    const debut = d.dateHeureDepart;
    const fin = d.dateHeureRetourPrevue;
    const m = this.source.manager;
    const [vehicules, chauffeurs, existantes] = await Promise.all([
      m.getRepository(Vehicule).find({ where: { actif: true }, order: { immatriculation: 'ASC' } }),
      m.getRepository(Chauffeur).find({ where: { actif: true }, order: { nomComplet: 'ASC' } }),
      m
        .getRepository(Affectation)
        .createQueryBuilder('a')
        .innerJoinAndSelect('a.vehicule', 'v')
        .innerJoinAndSelect('a.chauffeur', 'c')
        .leftJoinAndSelect('a.demandes', 'dd')
        .where('a.statut = :prevue', { prevue: StatutAffectation.PREVUE })
        .andWhere('a.dateHeureDebut < :fin AND a.dateHeureFin > :debut', { debut, fin })
        .orderBy('a.dateHeureDebut')
        .getMany(),
    ]);

    const vues = await Promise.all(
      vehicules.map(async (v) => {
        const conflits = await this.conflits(m, { vehiculeId: v.id }, debut, fin);
        const bloquant = this.bloquant(v, fin);
        return {
          id: v.id,
          immatriculation: v.immatriculation,
          marqueModele: v.marqueModele,
          nbPlaces: v.nbPlaces,
          libre: !conflits.length && !bloquant,
          bloquant,
          avertissements: this.avertissements(v, fin),
          conflits,
        };
      }),
    );
    const vuesChauffeurs = await Promise.all(
      chauffeurs.map(async (c) => {
        const conflits = await this.conflits(m, { chauffeurId: c.id }, debut, fin);
        return { id: c.id, nomComplet: c.nomComplet, telephone: c.telephone, libre: !conflits.length, conflits };
      }),
    );
    // Regroupement : rejoindre une affectation prévue qui chevauche la demande, si l'élargir ne crée pas de conflit
    const regroupements = await Promise.all(
      existantes.map(async (a) => {
        const union = this.union(a, debut, fin);
        const gene = [
          ...(await this.conflits(m, { vehiculeId: a.vehiculeId }, union.debut, union.fin, a.id)),
          ...(await this.conflits(m, { chauffeurId: a.chauffeurId }, union.debut, union.fin, a.id)),
        ];
        return {
          id: a.id,
          vehicule: { immatriculation: a.vehicule.immatriculation, marqueModele: a.vehicule.marqueModele, nbPlaces: a.vehicule.nbPlaces },
          chauffeur: { nomComplet: a.chauffeur.nomComplet },
          debut: a.dateHeureDebut,
          fin: a.dateHeureFin,
          demandes: (a.demandes ?? []).map((x) => ({ reference: x.reference, destination: x.destination })),
          possible: !gene.length && !this.bloquant(a.vehicule, union.fin),
        };
      }),
    );
    return { vehicules: vues, chauffeurs: vuesChauffeurs, regroupements };
  }

  /**
   * Affecte la demande (dans la transaction de la décision) : nouvelle affectation, ou regroupement avec
   * une affectation prévue dont la période est élargie. Véhicule et chauffeur sont verrouillés avant
   * le contrôle des conflits, pour que deux validations simultanées ne réservent pas le même créneau.
   */
  async affecter(m: EntityManager, d: DemandeDeplacement, acteurId: string, choix: ChoixAffectation): Promise<Affectation> {
    if (choix.affectationId) return this.regrouper(m, d, choix.affectationId);
    if (!choix.vehiculeId || !choix.chauffeurId) {
      throw new BadRequestException('Choisissez un véhicule et un chauffeur, ou une affectation existante à partager.');
    }
    const debut = d.dateHeureDepart;
    const fin = d.dateHeureRetourPrevue;
    await this.verrouiller(m, choix.vehiculeId, choix.chauffeurId);
    const vehicule = await m.findOneBy(Vehicule, { id: choix.vehiculeId });
    const chauffeur = await m.findOneBy(Chauffeur, { id: choix.chauffeurId });
    if (!vehicule) throw new NotFoundException('Véhicule introuvable.');
    if (!chauffeur || !chauffeur.actif) throw new BadRequestException('Ce chauffeur n’est pas disponible (hors service).');
    const bloquant = this.bloquant(vehicule, fin);
    if (bloquant) throw new ConflictException(`${vehicule.immatriculation} ne peut pas partir : ${bloquant.toLowerCase()}.`);
    await this.refuserSiConflit(m, vehicule, chauffeur, debut, fin);
    const a = m.create(Affectation, {
      vehiculeId: vehicule.id,
      chauffeurId: chauffeur.id,
      dateHeureDebut: debut,
      dateHeureFin: fin,
      statut: StatutAffectation.PREVUE,
      affectePar: { id: acteurId },
    });
    return m.save(a);
  }

  private async regrouper(m: EntityManager, d: DemandeDeplacement, affectationId: string): Promise<Affectation> {
    await m.query('SELECT 1 FROM affectation WHERE id = $1 FOR UPDATE', [affectationId]);
    const a = await m.findOne(Affectation, { where: { id: affectationId }, relations: { vehicule: true, chauffeur: true } });
    if (!a) throw new NotFoundException('Affectation introuvable.');
    if (a.statut !== StatutAffectation.PREVUE) throw new ConflictException('Cette affectation n’est plus modifiable (mission commencée ou terminée).');
    if (!(a.dateHeureDebut < d.dateHeureRetourPrevue && a.dateHeureFin > d.dateHeureDepart)) {
      throw new BadRequestException('Cette affectation ne couvre pas la période de la demande : elles ne peuvent pas être regroupées.');
    }
    await this.verrouiller(m, a.vehiculeId, a.chauffeurId);
    const union = this.union(a, d.dateHeureDepart, d.dateHeureRetourPrevue);
    const bloquant = this.bloquant(a.vehicule, union.fin);
    if (bloquant) throw new ConflictException(`${a.vehicule.immatriculation} ne peut pas partir : ${bloquant.toLowerCase()}.`);
    await this.refuserSiConflit(m, a.vehicule, a.chauffeur, union.debut, union.fin, a.id);
    a.dateHeureDebut = union.debut;
    a.dateHeureFin = union.fin;
    return m.save(a);
  }

  private async refuserSiConflit(m: EntityManager, v: Vehicule, c: Chauffeur, debut: Date, fin: Date, sauf?: string) {
    const [cv, cc] = await Promise.all([
      this.conflits(m, { vehiculeId: v.id }, debut, fin, sauf),
      this.conflits(m, { chauffeurId: c.id }, debut, fin, sauf),
    ]);
    const refs = (x: Conflit[]) => x.flatMap((k) => k.references).join(', ') || 'une autre mission';
    if (cv.length) throw new ConflictException(`${v.immatriculation} est déjà affecté sur cette période (${refs(cv)}).`);
    if (cc.length) throw new ConflictException(`${c.nomComplet} conduit déjà sur cette période (${refs(cc)}).`);
  }

  /** Verrous dans un ordre fixe (véhicule puis chauffeur) pour éviter les interblocages. */
  private async verrouiller(m: EntityManager, vehiculeId: string, chauffeurId: string) {
    await m.query('SELECT 1 FROM vehicule WHERE id = $1 FOR UPDATE', [vehiculeId]);
    await m.query('SELECT 1 FROM chauffeur WHERE id = $1 FOR UPDATE', [chauffeurId]);
  }

  private union(a: Affectation, debut: Date, fin: Date) {
    return {
      debut: a.dateHeureDebut < debut ? a.dateHeureDebut : debut,
      fin: a.dateHeureFin > fin ? a.dateHeureFin : fin,
    };
  }
}
