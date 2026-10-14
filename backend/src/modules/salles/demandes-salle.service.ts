import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { StatutDemande } from '../../common/enums/statut-demande.enum';
import { DecisionValidation, NiveauValidation } from '../../common/enums/validation.enum';
import { Acteur, DemandesService, estGestionnaire } from '../demandes/demandes.service';
import { Commentaire } from '../demandes/entities/commentaire.entity';
import { HistoriqueStatut } from '../demandes/entities/historique-statut.entity';
import { Validation } from '../demandes/entities/validation.entity';
import { Equipement } from '../ressources/entities/equipement.entity';
import { Salle } from '../ressources/entities/salle.entity';
import { vueSalle } from '../ressources/salles-ressource.service';
import { Utilisateur } from '../utilisateurs/entities/utilisateur.entity';
import { CommentaireDto, DecisionSalleDto, DemandeSalleDto, DisponibiliteDto, FiltreDemandesSalleDto } from './dto/demande-salle.dto';
import { DemandeSalle } from './entities/demande-salle.entity';

/** Statuts qui occupent la salle : une demande en attente bloque déjà le créneau. */
const STATUTS_OCCUPANTS = [StatutDemande.EN_ATTENTE_LOGISTIQUE, StatutDemande.CONFIRMEE];
/** Statuts qui occupent un appareil : les appareils ne sont fixés qu'à la confirmation par la logistique. */
const STATUTS_APPAREILS = [StatutDemande.CONFIRMEE];

/** Heures d'ouverture des salles, en heure de Madagascar (UTC+3, sans heure d'été). */
const OUVERTURE = 7 * 60;
const FERMETURE = 19 * 60;
const DECALAGE_MADAGASCAR = 3 * 60;
const PAS = 15; // minutes
const MINUTE = 60_000;

/** Minutes depuis minuit et jour, à l'heure de Madagascar. */
function heureLocale(d: Date) {
  const local = new Date(d.getTime() + DECALAGE_MADAGASCAR * MINUTE);
  return { jour: local.toISOString().slice(0, 10), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}
/** Instant correspondant à `minutes` après minuit (heure de Madagascar) le jour `jour` (AAAA-MM-JJ). */
const instant = (jour: string, minutes: number) => new Date(Date.parse(`${jour}T00:00:00Z`) + (minutes - DECALAGE_MADAGASCAR) * MINUTE);
const hhmm = (d: Date) => {
  const m = heureLocale(d).minutes;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}h${String(m % 60).padStart(2, '0')}`;
};

interface Occupation {
  id: string;
  salleId: string;
  debut: Date;
  fin: Date;
}

@Injectable()
export class DemandesSalleService {
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    private readonly demandes: DemandesService,
  ) {}

  // ---------------------------------------------------------------- consultation

  /** Créneaux occupés sur une période, pour le planning du formulaire. */
  async planning(acteur: Acteur, du: Date, au: Date) {
    await this.cloturerCreneauxPasses();
    const liste = await this.source
      .getRepository(DemandeSalle)
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.demandeur', 'demandeur')
      .where('d.statut IN (:...statuts)', { statuts: STATUTS_OCCUPANTS })
      .andWhere('d.creneauDebut < :au AND d.creneauFin > :du', { du, au })
      .orderBy('d.creneauDebut', 'ASC')
      .getMany();
    return liste.map((d) => ({
      id: d.id,
      salleId: d.salleId,
      debut: d.creneauDebut,
      fin: d.creneauFin,
      statut: d.statut,
      moi: d.demandeurId === acteur.id,
      // L'objet n'est montré qu'à ceux qui peuvent consulter la demande
      objet: this.demandes.peutVoir(acteur, d.demandeur) ? d.objet : null,
    }));
  }

  /**
   * Détection de conflits avant soumission (Figure 5) : pour chaque salle, libre ou non sur le créneau,
   * capacité suffisante ou non ; et, si la salle choisie est prise, le prochain créneau libre de même durée.
   */
  async disponibilite(dto: DisponibiliteDto) {
    this.controlerCreneau(dto.debut, dto.fin);
    const salles = (
      await this.source.getRepository(Salle).find({ where: { actif: true }, relations: { equipementsLies: true }, order: { nom: 'ASC' } })
    ).map(vueSalle);
    const occupations = await this.occupationsDuJour(this.source.manager, dto.debut);
    const enConflit = (salleId: string, debut: Date, fin: Date) =>
      occupations.filter((o) => o.salleId === salleId && o.debut < fin && o.fin > debut);

    const resultat = [];
    for (const s of salles) {
      const conflits = enConflit(s.id, dto.debut, dto.fin);
      resultat.push({
        salle: { id: s.id, nom: s.nom, capacite: s.capacite, equipements: s.equipements },
        // Pour chaque type de matériel de la salle : appareils en service et appareils libres sur le créneau
        materiel: await this.materielParType(this.source.manager, s.id, dto.debut, dto.fin),
        libre: conflits.length === 0,
        capaciteSuffisante: !dto.nbParticipants || dto.nbParticipants <= s.capacite,
        conflits: conflits.map((c) => ({ debut: c.debut, fin: c.fin })),
      });
    }

    let autreCreneau: { debut: Date; fin: Date } | null = null;
    const choisie = resultat.find((r) => r.salle.id === dto.salleId);
    if (choisie && !choisie.libre) {
      autreCreneau = this.prochainCreneauLibre(dto.debut, dto.fin, (d, f) => enConflit(choisie.salle.id, d, f).length === 0);
    }
    return { salles: resultat, autreCreneau };
  }

  /** Mes réservations. */
  async mesDemandes(acteur: Acteur) {
    await this.cloturerCreneauxPasses();
    const liste = await this.requete().where('d.demandeurId = :id', { id: acteur.id }).getMany();
    return liste.map((d) => this.resume(d, acteur));
  }

  /**
   * Demandes à suivre : toutes pour la logistique et l'administrateur ; celles des collaborateurs
   * pour un N+1 ; celles de sa direction pour l'assistante de direction.
   */
  async demandesASuivre(acteur: Acteur, filtre: FiltreDemandesSalleDto) {
    await this.cloturerCreneauxPasses();
    const qb = this.requete();
    if (!estGestionnaire(acteur)) {
      const conditions = ['demandeur.superieurDirectId = :moi'];
      if (acteur.roles.includes(Role.ASSISTANTE_DIRECTION) && acteur.direction) {
        conditions.push('lower(demandeur.direction) = lower(:direction)');
      }
      qb.where(`(${conditions.join(' OR ')})`, { moi: acteur.id, direction: acteur.direction }).andWhere('d.demandeurId <> :moi');
    }
    if (filtre.statut) qb.andWhere('d.statut = :statut', { statut: filtre.statut });
    const liste = await qb.getMany();
    return liste.map((d) => this.resume(d, acteur));
  }

  /**
   * Planning de la semaine pour la logistique : réservations en attente, confirmées ou terminées
   * sur la période, avec leurs détails, de la plus tôt à la plus tard.
   */
  async semaine(acteur: Acteur, du: Date, au: Date) {
    if (!estGestionnaire(acteur)) throw new ForbiddenException('Le planning des salles est réservé à la logistique.');
    if (au <= du || au.getTime() - du.getTime() > 31 * 24 * 60 * MINUTE) {
      throw new BadRequestException('Période invalide (un mois au plus).');
    }
    await this.cloturerCreneauxPasses();
    const liste = await this.requete()
      .where('d.statut IN (:...statuts)', { statuts: [...STATUTS_OCCUPANTS, StatutDemande.TERMINEE] })
      .andWhere('d.creneauDebut < :au AND d.creneauFin > :du', { du, au })
      .orderBy('d.creneauDebut', 'ASC')
      .getMany();
    return liste.map((d) => this.resume(d, acteur));
  }

  /** Détail : demande, décisions, commentaires et historique des statuts. */
  async detail(acteur: Acteur, id: string) {
    const d = await this.charger(this.source.manager, id);
    this.verifierAcces(acteur, d);
    const [validations, commentaires, historique] = await Promise.all([
      this.source.getRepository(Validation).find({ where: { demande: { id } }, relations: { validateur: true }, order: { date: 'ASC' } }),
      this.source.getRepository(Commentaire).find({ where: { demande: { id } }, relations: { auteur: true }, order: { date: 'ASC' } }),
      this.source.getRepository(HistoriqueStatut).find({ where: { demande: { id } }, relations: { auteur: true }, order: { date: 'ASC' } }),
    ]);
    const nom = (u: Utilisateur | null) => (u ? { id: u.id, nomComplet: u.nomComplet } : null);
    return {
      ...this.resume(d, acteur),
      validations: validations.map((v) => ({ niveau: v.niveau, decision: v.decision, date: v.date, validateur: nom(v.validateur), commentaire: v.commentaire })),
      commentaires: commentaires.map((c) => ({ id: c.id, texte: c.texte, date: c.date, auteur: nom(c.auteur) })),
      historique: historique.map((h) => ({ ancienStatut: h.ancienStatut, nouveauStatut: h.nouveauStatut, date: h.date, auteur: nom(h.auteur), commentaire: h.commentaire })),
    };
  }

  // ---------------------------------------------------------------- actions

  /** Soumission : contrôle du créneau et des conflits, puis passage en attente de la logistique. */
  async soumettre(acteur: Acteur, dto: DemandeSalleDto) {
    this.controlerCreneau(dto.debut, dto.fin);
    const id = await this.source.transaction(async (m) => {
      const salle = await this.verrouillerSalle(m, dto.salleId);
      if (!salle.actif) throw new BadRequestException(`« ${salle.nom} » est hors service.`);
      if (dto.nbParticipants > salle.capacite) {
        throw new BadRequestException(`« ${salle.nom} » est trop petite : ${salle.capacite} places pour ${dto.nbParticipants} participants.`);
      }
      await this.verifierLibre(m, salle, dto.debut, dto.fin);
      // Matériel demandé : on vérifie seulement que la salle en dispose ; l'appareil est choisi à la confirmation
      const materiel = await this.typesDeLaSalle(m, salle, dto.equipementsSouhaites ?? []);

      const d = m.create(DemandeSalle, {
        reference: await this.demandes.prochaineReference(m, 'SAL'),
        statut: StatutDemande.BROUILLON,
        demandeurId: acteur.id,
        soumisLe: new Date(),
        salleId: salle.id,
        creneauDebut: dto.debut,
        creneauFin: dto.fin,
        objet: dto.objet,
        nbParticipants: dto.nbParticipants,
        equipementsSouhaites: materiel,
        participants: dto.participants ?? null,
      });
      await m.save(d);
      // Circuit salle (4.1.1) : une seule validation, par le responsable logistique
      await this.demandes.changerStatut(m, d, StatutDemande.EN_ATTENTE_LOGISTIQUE, acteur.id);
      return d.id;
    });
    return this.detail(acteur, id);
  }

  /** Décision du responsable logistique : confirme (après nouveau contrôle de conflit) ou refuse avec un motif. */
  async decider(acteur: Acteur, id: string, dto: DecisionSalleDto) {
    if (!estGestionnaire(acteur)) throw new ForbiddenException("Seul le responsable logistique valide les réservations de salle.");
    if (dto.decision === DecisionValidation.REFUSEE && !dto.commentaire) {
      throw new BadRequestException('Indiquez le motif du refus : il sera communiqué au demandeur.');
    }
    await this.source.transaction(async (m) => {
      const d = await this.charger(m, id, true);
      if (d.statut !== StatutDemande.EN_ATTENTE_LOGISTIQUE) {
        throw new ConflictException(`Cette demande n'est plus en attente de validation (statut : ${d.statut}).`);
      }
      if (dto.decision === DecisionValidation.VALIDEE) {
        if (d.creneauDebut <= new Date()) throw new ConflictException('Le créneau est déjà commencé ou passé : la réservation ne peut plus être confirmée.');
        const salle = await this.verrouillerSalle(m, d.salleId);
        await this.verifierLibre(m, salle, d.creneauDebut, d.creneauFin, d.id);
        if (dto.appareilIds) {
          await this.reattribuerAppareils(m, d, dto.appareilIds);
        } else if ((d.equipementsSouhaites ?? []).length && !(d.equipementsAttribues ?? []).length) {
          const appareils = await this.attribuerAppareils(m, salle, d.equipementsSouhaites ?? [], d.creneauDebut, d.creneauFin);
          await m.createQueryBuilder().relation(DemandeSalle, 'equipementsAttribues').of(d.id).add(appareils.map((a) => a.id));
          d.equipementsAttribues = appareils;
        }
        await this.verifierAppareilsLibres(m, d);
      }
      await m.insert(Validation, {
        demande: { id: d.id },
        niveau: NiveauValidation.LOGISTIQUE,
        decision: dto.decision,
        validateur: { id: acteur.id },
        commentaire: dto.commentaire ?? null,
      });
      const statut = dto.decision === DecisionValidation.VALIDEE ? StatutDemande.CONFIRMEE : StatutDemande.REFUSEE;
      await this.demandes.changerStatut(m, d, statut, acteur.id, dto.commentaire ?? null);
    });
    return this.detail(acteur, id);
  }

  /**
   * Annulation par le demandeur (ou la logistique) : une demande en attente est « annulée » ;
   * une réservation confirmée qui n'a pas encore commencé est « libérée » (Figure 7).
   */
  async annuler(acteur: Acteur, id: string) {
    await this.source.transaction(async (m) => {
      const d = await this.charger(m, id, true);
      if (d.demandeurId !== acteur.id && !estGestionnaire(acteur)) {
        throw new ForbiddenException('Seul le demandeur ou la logistique peut annuler cette réservation.');
      }
      if (d.statut === StatutDemande.EN_ATTENTE_LOGISTIQUE) {
        await this.demandes.changerStatut(m, d, StatutDemande.ANNULEE, acteur.id);
      } else if (d.statut === StatutDemande.CONFIRMEE && d.creneauDebut > new Date()) {
        await this.demandes.changerStatut(m, d, StatutDemande.LIBEREE, acteur.id);
      } else {
        throw new ConflictException('Cette réservation ne peut plus être annulée.');
      }
    });
    return this.detail(acteur, id);
  }

  /**
   * Pour la logistique, avant de confirmer : pour chaque type de matériel demandé,
   * l'appareil attribué et les appareils de la salle libres sur le créneau.
   */
  async appareilsPossibles(acteur: Acteur, id: string) {
    if (!estGestionnaire(acteur)) throw new ForbiddenException('Réservé au responsable logistique.');
    const d = await this.charger(this.source.manager, id);
    const libres = await this.appareilsLibres(this.source.manager, d.salleId, d.creneauDebut, d.creneauFin, d.id);
    const meme = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    return (d.equipementsSouhaites ?? []).map((nom) => {
      const attribue = (d.equipementsAttribues ?? []).find((e) => meme(e.nom, nom));
      return {
        nom,
        attribueId: attribue?.id ?? null,
        options: libres
          .filter((e) => meme(e.nom, nom))
          // Appareils installés dans la salle avant les appareils partagés : le premier est proposé par défaut
          .sort((a, b) => Number(a.plusieursSalles) - Number(b.plusieursSalles) || a.reference.localeCompare(b.reference))
          .map((e) => ({ id: e.id, reference: e.reference, partage: e.plusieursSalles, description: e.description })),
      };
    });
  }

  /** Avis sur une demande, sans effet sur son statut. */
  async commenter(acteur: Acteur, id: string, dto: CommentaireDto) {
    const d = await this.charger(this.source.manager, id);
    this.verifierAcces(acteur, d);
    await this.source.getRepository(Commentaire).insert({ demande: { id }, auteur: { id: acteur.id }, texte: dto.texte });
    return this.detail(acteur, id);
  }

  // ---------------------------------------------------------------- règles internes

  /** Créneau valide : dans le futur, le même jour, entre 7 h et 19 h (heure de Madagascar), au moins 15 min. */
  private controlerCreneau(debut: Date, fin: Date) {
    if (fin <= debut) throw new BadRequestException("L'heure de fin doit être après l'heure de début.");
    if (debut.getTime() < Date.now() - MINUTE) throw new BadRequestException('Le créneau est déjà passé.');
    if (fin.getTime() - debut.getTime() < PAS * MINUTE) throw new BadRequestException('Une réservation dure au moins 15 minutes.');
    const d = heureLocale(debut);
    const f = heureLocale(fin);
    const finMinutes = f.jour === d.jour ? f.minutes : f.minutes === 0 && f.jour > d.jour ? 24 * 60 : Infinity;
    if (d.minutes < OUVERTURE || finMinutes > FERMETURE) {
      throw new BadRequestException('Les salles se réservent sur une même journée, entre 7h00 et 19h00.');
    }
  }

  /** Verrouille la salle pendant la transaction : deux réservations simultanées ne peuvent pas se chevaucher. */
  private async verrouillerSalle(m: EntityManager, salleId: string): Promise<Salle> {
    const salle = await m.getRepository(Salle).findOne({ where: { id: salleId }, lock: { mode: 'pessimistic_write' } });
    if (!salle) throw new NotFoundException('Salle introuvable.');
    return salle;
  }

  /** Appareils en service de la salle (installés ou partagés). */
  private appareilsDeLaSalle(m: EntityManager, salleId: string): Promise<Equipement[]> {
    return m
      .getRepository(Equipement)
      .createQueryBuilder('e')
      .innerJoin('e.salles', 's', 's.id = :salleId', { salleId })
      .where('e.actif = true')
      .orderBy('e.reference', 'ASC')
      .getMany();
  }

  /**
   * Appareils de la salle libres sur le créneau : un appareil attribué à une réservation confirmée
   * qui chevauche le créneau est indisponible, quelle que soit la salle de cette réservation.
   */
  private async appareilsLibres(m: EntityManager, salleId: string, debut: Date, fin: Date, sauf?: string): Promise<Equipement[]> {
    const pris: { id: string }[] = await m.query(
      `SELECT DISTINCT de.equipement_id AS id
         FROM demande_equipement de JOIN demande d ON d.id = de.demande_id
        WHERE d.statut = ANY($1) AND d.creneau_debut < $3 AND d.creneau_fin > $2 AND ($4::uuid IS NULL OR d.id <> $4)`,
      [STATUTS_APPAREILS, debut, fin, sauf ?? null],
    );
    const occupes = new Set(pris.map((p) => p.id));
    return (await this.appareilsDeLaSalle(m, salleId)).filter((e) => !occupes.has(e.id));
  }

  /** Par type de matériel de la salle : nombre d'appareils en service et nombre de libres sur le créneau. */
  private async materielParType(m: EntityManager, salleId: string, debut: Date, fin: Date) {
    const tous = await this.appareilsDeLaSalle(m, salleId);
    const libres = new Set((await this.appareilsLibres(m, salleId, debut, fin)).map((e) => e.id));
    const types = new Map<string, { nom: string; total: number; libres: number }>();
    for (const e of tous) {
      const t = types.get(e.nom.toLowerCase()) ?? { nom: e.nom, total: 0, libres: 0 };
      t.total += 1;
      if (libres.has(e.id)) t.libres += 1;
      types.set(e.nom.toLowerCase(), t);
    }
    return [...types.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }

  /** Types demandés présents dans la salle, sous leur nom exact ; erreur si la salle n'en dispose pas. */
  private async typesDeLaSalle(m: EntityManager, salle: Salle, types: string[]): Promise<string[]> {
    const deLaSalle = await this.appareilsDeLaSalle(m, salle.id);
    const absents = types.filter((t) => !deLaSalle.some((e) => e.nom.toLowerCase() === t.toLowerCase()));
    if (absents.length) throw new BadRequestException(`« ${salle.nom} » ne dispose pas de : ${absents.join(', ')}.`);
    return [...new Set(types.map((t) => deLaSalle.find((e) => e.nom.toLowerCase() === t.toLowerCase())!.nom))];
  }

  /**
   * Un appareil libre par type demandé, de préférence un appareil installé dans la salle plutôt qu'un appareil partagé.
   * Les appareils candidats sont verrouillés : deux réservations simultanées ne peuvent pas obtenir le même.
   */
  private async attribuerAppareils(m: EntityManager, salle: Salle, types: string[], debut: Date, fin: Date): Promise<Equipement[]> {
    if (!types.length) return [];
    const deLaSalle = await this.appareilsDeLaSalle(m, salle.id);
    const absents = types.filter((t) => !deLaSalle.some((e) => e.nom.toLowerCase() === t.toLowerCase()));
    if (absents.length) throw new BadRequestException(`« ${salle.nom} » ne dispose pas de : ${absents.join(', ')}.`);

    const candidats = deLaSalle
      .filter((e) => types.some((t) => t.toLowerCase() === e.nom.toLowerCase()))
      .map((e) => e.id)
      .sort();
    await m.query('SELECT id FROM equipement WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [candidats]);
    const libres = await this.appareilsLibres(m, salle.id, debut, fin);

    return types.map((t) => {
      const choix = libres
        .filter((e) => e.nom.toLowerCase() === t.toLowerCase())
        .sort((a, b) => Number(a.plusieursSalles) - Number(b.plusieursSalles) || a.reference.localeCompare(b.reference))[0];
      if (!choix) {
        throw new ConflictException(`Plus aucun « ${t} » libre pour « ${salle.nom} » sur ce créneau : tous sont déjà attribués à des réservations confirmées.`);
      }
      libres.splice(libres.indexOf(choix), 1);
      return choix;
    });
  }

  /**
   * Remplace les appareils de la demande par ceux choisis par la logistique : un appareil libre de la salle
   * pour chaque type de matériel demandé, ni plus ni moins.
   */
  private async reattribuerAppareils(m: EntityManager, d: DemandeSalle, ids: string[]) {
    const uniques = [...new Set(ids)].sort();
    await m.query('SELECT id FROM equipement WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [uniques]);
    const libres = await this.appareilsLibres(m, d.salleId, d.creneauDebut, d.creneauFin, d.id);
    const choisis = uniques.map((id) => {
      const e = libres.find((x) => x.id === id);
      if (!e) throw new ConflictException('Un des appareils choisis n’est pas libre sur ce créneau ou n’appartient pas à la salle.');
      return e;
    });
    const types = (d.equipementsSouhaites ?? []).map((t) => t.toLowerCase()).sort();
    const couverts = choisis.map((e) => e.nom.toLowerCase()).sort();
    if (types.join('|') !== couverts.join('|')) {
      throw new BadRequestException('Choisissez exactement un appareil pour chaque matériel demandé.');
    }
    const anciens = (d.equipementsAttribues ?? []).map((e) => e.id);
    await m.createQueryBuilder().relation(DemandeSalle, 'equipementsAttribues').of(d.id).addAndRemove(uniques, anciens);
    d.equipementsAttribues = choisis;
  }

  /** Avant confirmation : les appareils attribués à la demande sont toujours libres. */
  private async verifierAppareilsLibres(m: EntityManager, d: DemandeSalle) {
    const attribues = d.equipementsAttribues ?? [];
    if (!attribues.length) return;
    await m.query('SELECT id FROM equipement WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', [attribues.map((e) => e.id).sort()]);
    const libres = new Set((await this.appareilsLibres(m, d.salleId, d.creneauDebut, d.creneauFin, d.id)).map((e) => e.id));
    const pris = attribues.filter((e) => !libres.has(e.id));
    if (pris.length) {
      throw new ConflictException(`Déjà réservé sur ce créneau : ${pris.map((e) => `${e.nom} (${e.reference})`).join(', ')}.`);
    }
  }

  /** Conflit : chevauchement avec une réservation en attente ou confirmée de la même salle. */
  private async verifierLibre(m: EntityManager, salle: Salle, debut: Date, fin: Date, sauf?: string) {
    const qb = m
      .getRepository(DemandeSalle)
      .createQueryBuilder('d')
      .where('d.salleId = :salle', { salle: salle.id })
      .andWhere('d.statut IN (:...statuts)', { statuts: STATUTS_OCCUPANTS })
      .andWhere('d.creneauDebut < :fin AND d.creneauFin > :debut', { debut, fin })
      .orderBy('d.creneauDebut', 'ASC');
    if (sauf) qb.andWhere('d.id <> :sauf', { sauf });
    const conflit = await qb.getOne();
    if (conflit) {
      throw new ConflictException(
        `« ${salle.nom} » est déjà réservée de ${hhmm(conflit.creneauDebut)} à ${hhmm(conflit.creneauFin)} sur ce créneau. Choisissez une autre salle ou un autre horaire.`,
      );
    }
  }

  private async occupationsDuJour(m: EntityManager, jourDe: Date): Promise<Occupation[]> {
    const { jour } = heureLocale(jourDe);
    const liste = await m
      .getRepository(DemandeSalle)
      .createQueryBuilder('d')
      .where('d.statut IN (:...statuts)', { statuts: STATUTS_OCCUPANTS })
      .andWhere('d.creneauDebut < :fin AND d.creneauFin > :debut', { debut: instant(jour, 0), fin: instant(jour, 24 * 60) })
      .getMany();
    return liste.map((d) => ({ id: d.id, salleId: d.salleId, debut: d.creneauDebut, fin: d.creneauFin }));
  }

  /** Premier créneau libre de même durée le même jour : d'abord après l'heure demandée, sinon avant. */
  private prochainCreneauLibre(debut: Date, fin: Date, estLibre: (d: Date, f: Date) => boolean) {
    const { jour, minutes } = heureLocale(debut);
    const duree = Math.round((fin.getTime() - debut.getTime()) / MINUTE);
    const maintenant = Date.now();
    const candidats: number[] = [];
    for (let m = minutes + PAS; m + duree <= FERMETURE; m += PAS) candidats.push(m);
    for (let m = minutes - PAS; m >= OUVERTURE; m -= PAS) candidats.push(m);
    for (const m of candidats) {
      const d = instant(jour, m);
      const f = instant(jour, m + duree);
      if (d.getTime() > maintenant && estLibre(d, f)) return { debut: d, fin: f };
    }
    return null;
  }

  /** Les réservations confirmées dont le créneau est fini passent à « Terminée » (Figure 7). */
  private async cloturerCreneauxPasses() {
    await this.source.transaction(async (m) => {
      const finies = await m
        .getRepository(DemandeSalle)
        .createQueryBuilder('d')
        .setLock('pessimistic_write')
        .where('d.statut = :statut AND d.creneauFin <= now()', { statut: StatutDemande.CONFIRMEE })
        .getMany();
      for (const d of finies) await this.demandes.changerStatut(m, d, StatutDemande.TERMINEE, null);
    });
  }

  private requete() {
    return this.source
      .getRepository(DemandeSalle)
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.salle', 'salle')
      .leftJoinAndSelect('d.demandeur', 'demandeur')
      .leftJoinAndSelect('d.equipementsAttribues', 'appareil')
      .loadRelationCountAndMap('d.nbCommentaires', 'd.commentaires')
      .orderBy('d.creneauDebut', 'DESC');
  }

  /** `verrouiller` : bloque la demande jusqu'à la fin de la transaction (deux décisions simultanées impossibles). */
  private async charger(m: EntityManager, id: string, verrouiller = false): Promise<DemandeSalle> {
    if (verrouiller) await m.query('SELECT 1 FROM demande WHERE id = $1 FOR UPDATE', [id]);
    const d = await m.getRepository(DemandeSalle).findOne({ where: { id }, relations: { salle: true, demandeur: true, equipementsAttribues: true } });
    if (!d) throw new NotFoundException('Réservation introuvable.');
    return d;
  }

  private verifierAcces(acteur: Acteur, d: DemandeSalle) {
    if (!this.demandes.peutVoir(acteur, d.demandeur)) throw new ForbiddenException("Vous n'avez pas accès à cette réservation.");
  }

  /** Ce que l'API renvoie d'une réservation, avec les actions permises à l'utilisateur. */
  private resume(d: DemandeSalle & { nbCommentaires?: number }, acteur: Acteur) {
    const gestionnaire = estGestionnaire(acteur);
    const auteur = d.demandeurId === acteur.id;
    const aVenir = d.creneauDebut > new Date();
    return {
      id: d.id,
      reference: d.reference,
      statut: d.statut,
      salle: { id: d.salle.id, nom: d.salle.nom, capacite: d.salle.capacite },
      creneauDebut: d.creneauDebut,
      creneauFin: d.creneauFin,
      objet: d.objet,
      nbParticipants: d.nbParticipants,
      equipementsSouhaites: d.equipementsSouhaites ?? [],
      equipementsAttribues: (d.equipementsAttribues ?? [])
        .map((e) => ({ id: e.id, nom: e.nom, reference: e.reference }))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.reference.localeCompare(b.reference)),
      participants: d.participants,
      soumisLe: d.soumisLe,
      demandeur: { id: d.demandeur.id, nomComplet: d.demandeur.nomComplet, direction: d.demandeur.direction, service: d.demandeur.service },
      nbCommentaires: d.nbCommentaires ?? 0,
      actions: {
        decider: gestionnaire && d.statut === StatutDemande.EN_ATTENTE_LOGISTIQUE,
        annuler:
          (auteur || gestionnaire) &&
          (d.statut === StatutDemande.EN_ATTENTE_LOGISTIQUE || (d.statut === StatutDemande.CONFIRMEE && aVenir)),
      },
    };
  }
}
