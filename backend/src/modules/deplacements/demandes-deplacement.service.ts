import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { StatutDemande } from '../../common/enums/statut-demande.enum';
import { TypeDeplacement } from '../../common/enums/type-demande.enum';
import { DecisionValidation, NiveauValidation } from '../../common/enums/validation.enum';
import { Acteur, DemandesService, estGestionnaire } from '../demandes/demandes.service';
import { Commentaire } from '../demandes/entities/commentaire.entity';
import { HistoriqueStatut } from '../demandes/entities/historique-statut.entity';
import { Validation } from '../demandes/entities/validation.entity';
import { DeplacementMail, NotificationsService } from '../notifications/notifications.service';
import { Utilisateur } from '../utilisateurs/entities/utilisateur.entity';
import { AffectationsService } from './affectations.service';
import {
  DecisionLogistiqueDto, DecisionN1Dto, DemandeDeplacementDto, FiltreDemandesDeplacementDto, RetourMissionDto,
} from './dto/demande-deplacement.dto';
import { Affectation, StatutAffectation } from './entities/affectation.entity';
import { DemandeDeplacement } from './entities/demande-deplacement.entity';

const FUSEAU = 'Indian/Antananarivo';
const jourLocal = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: FUSEAU }).format(d); // AAAA-MM-JJ

/** Statuts où la demande peut encore être annulée par son auteur. */
const ANNULABLES = [StatutDemande.EN_ATTENTE_N1, StatutDemande.EN_ATTENTE_LOGISTIQUE];

/**
 * Demandes de déplacement (circuit 4.1.1) : soumission, suivi et annulation par le demandeur,
 * validation par le supérieur direct (N+1), puis par la logistique qui affecte un véhicule et un chauffeur
 * et suit la mission (départ, retour, incidents).
 */
@Injectable()
export class DemandesDeplacementService {
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    private readonly demandes: DemandesService,
    private readonly notifications: NotificationsService,
    private readonly affectations: AffectationsService,
  ) {}

  // ---------------------------------------------------------------- consultation

  async mesDemandes(acteur: Acteur) {
    const liste = await this.requete().where('d.demandeurId = :id', { id: acteur.id }).getMany();
    return liste.map((d) => this.resume(d, acteur));
  }

  /**
   * Demandes à suivre : toutes pour la logistique et l'administrateur ; celles des collaborateurs
   * pour un N+1 ; celles de sa direction pour l'assistante de direction (consultation).
   */
  async demandesASuivre(acteur: Acteur, filtre: FiltreDemandesDeplacementDto) {
    const qb = this.requete();
    if (!estGestionnaire(acteur)) {
      const conditions = ['demandeur.superieurDirectId = :moi'];
      if (acteur.roles.includes(Role.ASSISTANTE_DIRECTION) && acteur.direction) {
        conditions.push('lower(demandeur.direction) = lower(:direction)');
      }
      qb.where(`(${conditions.join(' OR ')})`, { moi: acteur.id, direction: acteur.direction }).andWhere('d.demandeurId <> :moi');
    }
    if (filtre.statut) qb.andWhere('d.statut = :statut', { statut: filtre.statut });
    return (await qb.getMany()).map((d) => this.resume(d, acteur));
  }

  async detail(acteur: Acteur, id: string) {
    const d = await this.charger(this.source.manager, id);
    if (!this.demandes.peutVoir(acteur, d.demandeur)) throw new ForbiddenException("Vous n'avez pas accès à cette demande.");
    const [validations, commentaires, historique] = await Promise.all([
      this.source.getRepository(Validation).find({ where: { demande: { id } }, relations: { validateur: true }, order: { date: 'ASC' } }),
      this.source.getRepository(Commentaire).find({ where: { demande: { id } }, relations: { auteur: true }, order: { date: 'ASC' } }),
      this.source.getRepository(HistoriqueStatut).find({ where: { demande: { id } }, relations: { auteur: true }, order: { date: 'ASC' } }),
    ]);
    const personne = (u: Utilisateur | null) => (u ? { id: u.id, nomComplet: u.nomComplet } : null);
    return {
      ...this.resume(d, acteur),
      itineraireRetenu: d.itineraireRetenu,
      validations: validations.map((v) => ({
        niveau: v.niveau, decision: v.decision, date: v.date, validateur: personne(v.validateur), commentaire: v.commentaire,
      })),
      commentaires: commentaires.map((c) => ({ id: c.id, texte: c.texte, date: c.date, auteur: personne(c.auteur) })),
      historique: historique.map((h) => ({
        ancienStatut: h.ancienStatut, nouveauStatut: h.nouveauStatut, date: h.date, auteur: personne(h.auteur), commentaire: h.commentaire,
      })),
    };
  }

  // ---------------------------------------------------------------- actions

  async soumettre(acteur: Acteur, dto: DemandeDeplacementDto) {
    this.controler(dto);
    const soumise = await this.source.transaction(async (m) => {
      const demandeur = await m.findOneByOrFail(Utilisateur, { id: acteur.id });
      const d = m.create(DemandeDeplacement, {
        reference: await this.demandes.prochaineReference(m, 'DEP'),
        statut: StatutDemande.BROUILLON,
        demandeurId: acteur.id,
        soumisLe: new Date(),
        typeDeplacement: dto.typeDeplacement,
        motif: dto.motif,
        lieuDepart: dto.lieuDepart,
        departLatitude: dto.departLatitude,
        departLongitude: dto.departLongitude,
        destination: dto.destination,
        destinationLatitude: dto.destinationLatitude,
        destinationLongitude: dto.destinationLongitude,
        itineraireRetenu: dto.itineraireRetenu ?? null,
        distanceEstimeeKm: dto.distanceEstimeeKm ?? null,
        dateHeureDepart: dto.dateHeureDepart,
        dateHeureRetourPrevue: dto.dateHeureRetourPrevue,
        dureeMissionJours: dto.typeDeplacement === TypeDeplacement.MISSION ? (dto.dureeMissionJours ?? null) : null,
        personnesConcernees: dto.personnesConcernees ?? null,
      });
      await m.save(d);
      // Circuit déplacement (4.1.1) : le N+1 d'abord ; sans N+1 connu, la demande va directement à la logistique
      if (demandeur.superieurDirectId) {
        await this.demandes.changerStatut(m, d, StatutDemande.EN_ATTENTE_N1, acteur.id);
      } else {
        await this.demandes.changerStatut(
          m, d, StatutDemande.EN_ATTENTE_LOGISTIQUE, acteur.id, 'Aucun supérieur direct connu : demande transmise à la logistique.',
        );
      }
      return { d, demandeur };
    });
    await this.prevenirSoumission(soumise.d, soumise.demandeur);
    return this.detail(acteur, soumise.d.id);
  }

  /** Décision du supérieur direct : validée, la demande passe à la logistique ; refusée, le circuit s'arrête. */
  async deciderN1(acteur: Acteur, id: string, dto: DecisionN1Dto) {
    if (dto.decision === DecisionValidation.REFUSEE && !dto.commentaire) {
      throw new BadRequestException('Indiquez le motif du refus : il sera communiqué au demandeur.');
    }
    const d = await this.source.transaction(async (m) => {
      const d = await this.charger(m, id, true);
      if (d.demandeur.superieurDirectId !== acteur.id) {
        throw new ForbiddenException('Seul le supérieur direct du demandeur valide cette demande.');
      }
      if (d.statut !== StatutDemande.EN_ATTENTE_N1) {
        throw new ConflictException(`Cette demande n'attend plus votre validation (statut : ${d.statut}).`);
      }
      await m.insert(Validation, {
        demande: { id: d.id },
        niveau: NiveauValidation.N1,
        decision: dto.decision,
        validateur: { id: acteur.id },
        commentaire: dto.commentaire ?? null,
      });
      const statut = dto.decision === DecisionValidation.VALIDEE ? StatutDemande.EN_ATTENTE_LOGISTIQUE : StatutDemande.REFUSEE;
      await this.demandes.changerStatut(m, d, statut, acteur.id, dto.commentaire ?? null);
      return d;
    });
    if (dto.decision === DecisionValidation.REFUSEE) {
      const superieur = await this.source.getRepository(Utilisateur).findOneBy({ id: acteur.id });
      this.notifications.refusN1Deplacement(this.infosMail(d), superieur?.nomComplet ?? 'votre supérieur direct', dto.commentaire!);
    }
    return this.detail(acteur, id);
  }

  /** Pour la logistique, avant de valider : véhicules, chauffeurs et regroupements possibles. */
  async optionsAffectation(acteur: Acteur, id: string) {
    if (!estGestionnaire(acteur)) throw new ForbiddenException('Réservé au responsable logistique.');
    return this.affectations.options(await this.charger(this.source.manager, id));
  }

  /**
   * Décision du responsable logistique : validée, la demande est affectée (véhicule et chauffeur,
   * ou regroupement avec une affectation existante) après contrôle des conflits ; refusée, avec un motif.
   */
  async deciderLogistique(acteur: Acteur, id: string, dto: DecisionLogistiqueDto) {
    if (!estGestionnaire(acteur)) throw new ForbiddenException('Seul le responsable logistique valide à ce niveau.');
    if (dto.decision === DecisionValidation.REFUSEE && !dto.commentaire) {
      throw new BadRequestException('Indiquez le motif du refus : il sera communiqué au demandeur.');
    }
    await this.source.transaction(async (m) => {
      const d = await this.charger(m, id, true);
      if (d.statut !== StatutDemande.EN_ATTENTE_LOGISTIQUE) {
        throw new ConflictException(`Cette demande n'est pas en attente de la logistique (statut : ${d.statut}).`);
      }
      if (dto.decision === DecisionValidation.VALIDEE) {
        if (d.dateHeureDepart <= new Date()) throw new ConflictException("L'heure de départ est passée : la demande ne peut plus être affectée.");
        const a = await this.affectations.affecter(m, d, acteur.id, dto);
        await m.update(DemandeDeplacement, { id: d.id }, { affectationId: a.id });
      }
      await m.insert(Validation, {
        demande: { id: d.id },
        niveau: NiveauValidation.LOGISTIQUE,
        decision: dto.decision,
        validateur: { id: acteur.id },
        commentaire: dto.commentaire ?? null,
      });
      const statut = dto.decision === DecisionValidation.VALIDEE ? StatutDemande.VALIDEE : StatutDemande.REFUSEE;
      await this.demandes.changerStatut(m, d, statut, acteur.id, dto.commentaire ?? null);
    });
    // Après validation de la transaction : le demandeur est prévenu (véhicule et chauffeur, ou motif du refus)
    const d = await this.charger(this.source.manager, id);
    this.notifications.decisionLogistiqueDeplacement(
      this.infosMail(d),
      d.affectation
        ? {
            vehicule: [d.affectation.vehicule.immatriculation, d.affectation.vehicule.marqueModele].filter(Boolean).join(' · '),
            chauffeur: [d.affectation.chauffeur.nomComplet, d.affectation.chauffeur.telephone].filter(Boolean).join(' · '),
          }
        : null,
      dto.commentaire ?? null,
    );
    return this.detail(acteur, id);
  }

  /**
   * Départ de la mission (logistique) : l'affectation passe « En cours », ainsi que toutes les demandes
   * qu'elle sert (missions regroupées).
   */
  async depart(acteur: Acteur, id: string) {
    if (!estGestionnaire(acteur)) throw new ForbiddenException('Réservé au responsable logistique.');
    await this.source.transaction(async (m) => {
      const a = await this.affectationDe(m, id);
      if (a.statut !== StatutAffectation.PREVUE) throw new ConflictException('Le départ de cette mission est déjà enregistré.');
      const maintenant = new Date();
      if (a.dateHeureDebut.getTime() - maintenant.getTime() > 24 * 3_600_000) {
        throw new BadRequestException('Le départ est prévu dans plus de 24 heures : il ne peut pas encore être enregistré.');
      }
      await m.update(Affectation, { id: a.id }, { statut: StatutAffectation.EN_COURS, heureDepartReelle: maintenant });
      for (const d of a.demandes) {
        if (d.statut === StatutDemande.VALIDEE) await this.demandes.changerStatut(m, d, StatutDemande.EN_COURS, acteur.id);
      }
    });
    return this.detail(acteur, id);
  }

  /**
   * Retour de la mission (logistique) : heure réelle et incidents ; l'affectation et ses demandes
   * passent « Terminée », le véhicule et le chauffeur sont de nouveau libres.
   */
  async retour(acteur: Acteur, id: string, dto: RetourMissionDto) {
    if (!estGestionnaire(acteur)) throw new ForbiddenException('Réservé au responsable logistique.');
    await this.source.transaction(async (m) => {
      const a = await this.affectationDe(m, id);
      if (a.statut !== StatutAffectation.EN_COURS) throw new ConflictException('Enregistrez d’abord le départ de la mission.');
      const heure = dto.heureRetourReelle ?? new Date();
      if (heure.getTime() > Date.now() + 5 * 60_000) throw new BadRequestException('L’heure de retour ne peut pas être dans le futur.');
      if (a.heureDepartReelle && heure <= a.heureDepartReelle) throw new BadRequestException('Le retour doit être après le départ.');
      await m.update(Affectation, { id: a.id }, {
        statut: StatutAffectation.TERMINEE,
        heureRetourReelle: heure,
        incidents: dto.incidents ?? null,
      });
      for (const d of a.demandes) {
        if (d.statut === StatutDemande.EN_COURS) {
          await this.demandes.changerStatut(m, d, StatutDemande.TERMINEE, acteur.id, dto.incidents ? `Incidents : ${dto.incidents}` : null);
        }
      }
    });
    return this.detail(acteur, id);
  }

  /** Affectation de la demande, verrouillée, avec toutes les demandes qu'elle sert. */
  private async affectationDe(m: EntityManager, demandeId: string): Promise<Affectation> {
    const d = await this.charger(m, demandeId);
    if (!d.affectationId) throw new ConflictException('Cette demande n’a pas encore de véhicule affecté.');
    await m.query('SELECT 1 FROM affectation WHERE id = $1 FOR UPDATE', [d.affectationId]);
    return m.findOneOrFail(Affectation, { where: { id: d.affectationId }, relations: { demandes: true } });
  }

  /** Annulation par le demandeur (ou la logistique) tant que la demande n'est pas validée. */
  async annuler(acteur: Acteur, id: string) {
    await this.source.transaction(async (m) => {
      const d = await this.charger(m, id, true);
      if (d.demandeurId !== acteur.id && !estGestionnaire(acteur)) {
        throw new ForbiddenException('Seul le demandeur ou la logistique peut annuler cette demande.');
      }
      if (!ANNULABLES.includes(d.statut)) throw new ConflictException('Cette demande ne peut plus être annulée.');
      await this.demandes.changerStatut(m, d, StatutDemande.ANNULEE, acteur.id);
    });
    return this.detail(acteur, id);
  }

  // ---------------------------------------------------------------- règles

  private controler(dto: DemandeDeplacementDto) {
    const depart = dto.dateHeureDepart;
    const retour = dto.dateHeureRetourPrevue;
    if (depart.getTime() < Date.now() - 5 * 60_000) throw new BadRequestException('La date de départ est déjà passée.');
    if (retour <= depart) throw new BadRequestException('Le retour doit être après le départ.');
    if (dto.typeDeplacement === TypeDeplacement.VILLE && jourLocal(depart) !== jourLocal(retour)) {
      throw new BadRequestException('Un déplacement en ville est un aller-retour dans la journée : choisissez « Mission » pour plusieurs jours.');
    }
    if (dto.departLatitude === dto.destinationLatitude && dto.departLongitude === dto.destinationLongitude) {
      throw new BadRequestException('Le lieu de départ et la destination sont identiques.');
    }
  }

  // ---------------------------------------------------------------- e-mails

  /** Après l'envoi : e-mail au N+1 (à valider) et aux assistantes de direction de la direction du demandeur. */
  private async prevenirSoumission(d: DemandeDeplacement, demandeur: Utilisateur) {
    const depot = this.source.getRepository(Utilisateur);
    const superieur =
      d.statut === StatutDemande.EN_ATTENTE_N1 && demandeur.superieurDirectId
        ? await depot.findOneBy({ id: demandeur.superieurDirectId, actif: true })
        : null;
    const assistantes = demandeur.direction
      ? (
          await depot
            .createQueryBuilder('u')
            .where('u.actif = true AND u.id <> :id AND lower(u.direction) = lower(:direction)', {
              id: demandeur.id,
              direction: demandeur.direction,
            })
            .getMany()
        ).filter((u) => u.roles.includes(Role.ASSISTANTE_DIRECTION))
      : [];
    d.demandeur = demandeur;
    this.notifications.deplacementSoumis(this.infosMail(d), superieur, assistantes);
  }

  private infosMail(d: DemandeDeplacement): DeplacementMail {
    return {
      reference: d.reference,
      mission: d.typeDeplacement === TypeDeplacement.MISSION,
      demandeur: { nomComplet: d.demandeur.nomComplet, email: d.demandeur.email, direction: d.demandeur.direction },
      lieuDepart: d.lieuDepart,
      destination: d.destination,
      dateHeureDepart: d.dateHeureDepart,
      dateHeureRetourPrevue: d.dateHeureRetourPrevue,
      motif: d.motif,
      distanceEstimeeKm: d.distanceEstimeeKm,
    };
  }

  // ---------------------------------------------------------------- outils

  private requete() {
    return this.source
      .getRepository(DemandeDeplacement)
      .createQueryBuilder('d')
      .innerJoinAndSelect('d.demandeur', 'demandeur')
      .leftJoinAndSelect('d.affectation', 'affectation')
      .leftJoinAndSelect('affectation.vehicule', 'vehicule')
      .leftJoinAndSelect('affectation.chauffeur', 'chauffeur')
      .orderBy('d.dateHeureDepart', 'DESC');
  }

  private async charger(m: EntityManager, id: string, verrouiller = false): Promise<DemandeDeplacement> {
    if (verrouiller) await m.query('SELECT 1 FROM demande WHERE id = $1 FOR UPDATE', [id]);
    const d = await m.getRepository(DemandeDeplacement).findOne({
      where: { id },
      relations: { demandeur: true, affectation: { vehicule: true, chauffeur: true } },
    });
    if (!d) throw new NotFoundException('Demande de déplacement introuvable.');
    return d;
  }

  /** Ce que l'API renvoie d'une demande, avec les actions permises à l'utilisateur. */
  private resume(d: DemandeDeplacement, acteur: Acteur) {
    const auteur = d.demandeurId === acteur.id;
    return {
      id: d.id,
      reference: d.reference,
      statut: d.statut,
      typeDeplacement: d.typeDeplacement,
      motif: d.motif,
      lieuDepart: d.lieuDepart,
      depart: { lat: d.departLatitude, lon: d.departLongitude },
      destination: d.destination,
      arrivee: { lat: d.destinationLatitude, lon: d.destinationLongitude },
      distanceEstimeeKm: d.distanceEstimeeKm,
      dateHeureDepart: d.dateHeureDepart,
      dateHeureRetourPrevue: d.dateHeureRetourPrevue,
      dureeMissionJours: d.dureeMissionJours,
      personnesConcernees: d.personnesConcernees,
      soumisLe: d.soumisLe,
      demandeur: { id: d.demandeur.id, nomComplet: d.demandeur.nomComplet, direction: d.demandeur.direction, service: d.demandeur.service },
      affectation: d.affectation
        ? {
            id: d.affectation.id,
            statut: d.affectation.statut,
            debut: d.affectation.dateHeureDebut,
            fin: d.affectation.dateHeureFin,
            heureDepartReelle: d.affectation.heureDepartReelle,
            heureRetourReelle: d.affectation.heureRetourReelle,
            incidents: d.affectation.incidents,
            vehicule: {
              immatriculation: d.affectation.vehicule.immatriculation,
              marqueModele: d.affectation.vehicule.marqueModele,
              nbPlaces: d.affectation.vehicule.nbPlaces,
            },
            chauffeur: { nomComplet: d.affectation.chauffeur.nomComplet, telephone: d.affectation.chauffeur.telephone },
          }
        : null,
      actions: {
        deciderN1: d.demandeur.superieurDirectId === acteur.id && d.statut === StatutDemande.EN_ATTENTE_N1,
        deciderLogistique: estGestionnaire(acteur) && d.statut === StatutDemande.EN_ATTENTE_LOGISTIQUE,
        depart: estGestionnaire(acteur) && d.affectation?.statut === StatutAffectation.PREVUE,
        retour: estGestionnaire(acteur) && d.affectation?.statut === StatutAffectation.EN_COURS,
        annuler: (auteur || estGestionnaire(acteur)) && ANNULABLES.includes(d.statut),
      },
    };
  }
}
