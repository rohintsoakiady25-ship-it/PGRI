import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { StatutDemande } from '../../common/enums/statut-demande.enum';
import { DecisionValidation, NiveauValidation } from '../../common/enums/validation.enum';
import { Acteur, DemandesService, estGestionnaire } from '../demandes/demandes.service';
import { HistoriqueStatut } from '../demandes/entities/historique-statut.entity';
import { Validation } from '../demandes/entities/validation.entity';
import { FournitureMail, NotificationsService } from '../notifications/notifications.service';
import { ArticleStock } from '../ressources/entities/article-stock.entity';
import { Utilisateur } from '../utilisateurs/entities/utilisateur.entity';
import { DecisionFournitureDto, DemandeFournitureDto, FiltreDemandesFournitureDto, RemiseDto } from './dto/demande-fourniture.dto';
import { BonDeSortie } from './entities/bon-de-sortie.entity';
import { MouvementStock, TypeMouvement } from './entities/mouvement-stock.entity';
import { DemandeFourniture } from './entities/demande-fourniture.entity';
import { LigneFourniture } from './entities/ligne-fourniture.entity';

const FUSEAU = 'Indian/Antananarivo';
const aujourdhui = () => new Intl.DateTimeFormat('fr-CA', { timeZone: FUSEAU }).format(new Date()); // AAAA-MM-JJ

/** Statuts où la demande peut encore être annulée par son auteur. */
const ANNULABLES = [StatutDemande.EN_ATTENTE_N1, StatutDemande.EN_ATTENTE_LOGISTIQUE];

/** Statuts que le magasinier voit : demandes validées, à préparer et à remettre. */
const STATUTS_MAGASIN = [StatutDemande.VALIDEE, StatutDemande.EN_PREPARATION, StatutDemande.REMISE];

const estMagasinier = (a: Acteur) => a.roles.includes(Role.MAGASINIER);
/** Préparation et remise : le magasinier, ou l'administrateur en dépannage. */
const peutRemettre = (a: Acteur) => estMagasinier(a) || a.roles.includes(Role.ADMIN);

/**
 * Demandes de fournitures (circuit 4.1.1) : soumission, suivi et annulation par le demandeur,
 * validation par le N+1 puis par la logistique, préparation et remise par le magasinier (sortie de stock,
 * bon de sortie numérique).
 */
@Injectable()
export class DemandesFournitureService {
  constructor(
    @InjectDataSource() private readonly source: DataSource,
    private readonly demandes: DemandesService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------------------------------------------------------------- consultation

  async mesDemandes(acteur: Acteur) {
    const liste = await this.requete().where('d.demandeurId = :id', { id: acteur.id }).getMany();
    return liste.map((d) => this.resume(d, acteur));
  }

  /**
   * Demandes à suivre : toutes pour la logistique et l'administrateur ; celles des collaborateurs
   * pour un N+1 ; celles de sa direction pour l'assistante de direction ; les demandes validées pour le magasinier.
   */
  async demandesASuivre(acteur: Acteur, filtre: FiltreDemandesFournitureDto) {
    const qb = this.requete();
    if (!estGestionnaire(acteur)) {
      const conditions = ['demandeur.superieurDirectId = :moi'];
      if (acteur.roles.includes(Role.ASSISTANTE_DIRECTION) && acteur.direction) conditions.push('lower(demandeur.direction) = lower(:direction)');
      if (estMagasinier(acteur)) conditions.push('d.statut IN (:...magasin)');
      qb.where(`(${conditions.join(' OR ')})`, { moi: acteur.id, direction: acteur.direction, magasin: STATUTS_MAGASIN })
        .andWhere('d.demandeurId <> :moi');
    }
    if (filtre.statut) qb.andWhere('d.statut = :statut', { statut: filtre.statut });
    return (await qb.getMany()).map((d) => this.resume(d, acteur));
  }

  async detail(acteur: Acteur, id: string) {
    const d = await this.charger(this.source.manager, id);
    if (!this.peutVoir(acteur, d)) throw new ForbiddenException("Vous n'avez pas accès à cette demande.");
    const [validations, historique] = await Promise.all([
      this.source.getRepository(Validation).find({ where: { demande: { id } }, relations: { validateur: true }, order: { date: 'ASC' } }),
      this.source.getRepository(HistoriqueStatut).find({ where: { demande: { id } }, relations: { auteur: true }, order: { date: 'ASC' } }),
    ]);
    const personne = (u: Utilisateur | null) => (u ? { id: u.id, nomComplet: u.nomComplet } : null);
    return {
      ...this.resume(d, acteur),
      validations: validations.map((v) => ({
        niveau: v.niveau, decision: v.decision, date: v.date, validateur: personne(v.validateur), commentaire: v.commentaire,
      })),
      historique: historique.map((h) => ({
        ancienStatut: h.ancienStatut, nouveauStatut: h.nouveauStatut, date: h.date, auteur: personne(h.auteur), commentaire: h.commentaire,
      })),
    };
  }

  // ---------------------------------------------------------------- actions

  async soumettre(acteur: Acteur, dto: DemandeFournitureDto) {
    const ids = dto.lignes.map((l) => l.articleId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Un même article apparaît sur plusieurs lignes : regroupez les quantités sur une seule ligne.');
    }
    if (dto.dateBesoin && dto.dateBesoin < aujourdhui()) throw new BadRequestException('La date du besoin est déjà passée.');

    const soumise = await this.source.transaction(async (m) => {
      const articles = await m.findBy(ArticleStock, { id: In(ids) });
      for (const l of dto.lignes) {
        const a = articles.find((x) => x.id === l.articleId);
        if (!a) throw new BadRequestException('Un des articles choisis n’existe plus dans le catalogue.');
        if (!a.actif) throw new BadRequestException(`« ${a.nom} » n’est plus proposé par le magasin.`);
      }
      const demandeur = await m.findOneByOrFail(Utilisateur, { id: acteur.id });
      const d = m.create(DemandeFourniture, {
        reference: await this.demandes.prochaineReference(m, 'FOU'),
        statut: StatutDemande.BROUILLON,
        demandeurId: acteur.id,
        soumisLe: new Date(),
        dateBesoin: dto.dateBesoin ?? null,
        observations: dto.observations ?? null,
      });
      await m.save(d);
      await m.insert(
        LigneFourniture,
        dto.lignes.map((l, i) => ({
          demande: { id: d.id },
          article: { id: l.articleId },
          quantiteDemandee: l.quantite,
          observations: l.observations ?? null,
          ordre: i,
        })),
      );
      // Circuit fournitures (4.1.1) : le N+1 d'abord ; sans N+1 connu, la demande va directement à la logistique
      if (demandeur.superieurDirectId) {
        await this.demandes.changerStatut(m, d, StatutDemande.EN_ATTENTE_N1, acteur.id);
      } else {
        await this.demandes.changerStatut(
          m, d, StatutDemande.EN_ATTENTE_LOGISTIQUE, acteur.id, 'Aucun supérieur direct connu : demande transmise à la logistique.',
        );
      }
      return { id: d.id, demandeur, statut: d.statut };
    });

    // E-mail au N+1 pour validation
    if (soumise.statut === StatutDemande.EN_ATTENTE_N1 && soumise.demandeur.superieurDirectId) {
      const superieur = await this.source.getRepository(Utilisateur).findOneBy({ id: soumise.demandeur.superieurDirectId, actif: true });
      if (superieur) this.notifications.fournitureSoumise(this.infosMail(await this.charger(this.source.manager, soumise.id)), superieur);
    }
    return this.detail(acteur, soumise.id);
  }

  /** Décision du supérieur direct : validée, la demande passe à la logistique ; refusée, le circuit s'arrête. */
  async deciderN1(acteur: Acteur, id: string, dto: DecisionFournitureDto) {
    this.motifSiRefus(dto);
    const d = await this.source.transaction(async (m) => {
      const d = await this.charger(m, id, true);
      if (d.demandeur.superieurDirectId !== acteur.id) throw new ForbiddenException('Seul le supérieur direct du demandeur valide cette demande.');
      if (d.statut !== StatutDemande.EN_ATTENTE_N1) {
        throw new ConflictException(`Cette demande n'attend plus votre validation (statut : ${d.statut}).`);
      }
      const statut = dto.decision === DecisionValidation.VALIDEE ? StatutDemande.EN_ATTENTE_LOGISTIQUE : StatutDemande.REFUSEE;
      await this.decider(m, d, acteur, NiveauValidation.N1, dto, statut);
      return d;
    });
    if (dto.decision === DecisionValidation.REFUSEE) {
      const superieur = await this.source.getRepository(Utilisateur).findOneBy({ id: acteur.id });
      this.notifications.decisionFourniture(this.infosMail(d), false, `votre supérieur direct (${superieur?.nomComplet ?? '—'})`, dto.commentaire!);
    }
    return this.detail(acteur, id);
  }

  /**
   * Décision du responsable logistique : validée, la demande part au magasin (les magasiniers sont prévenus) ;
   * refusée, avec un motif. Le demandeur reçoit un e-mail dans les deux cas.
   */
  async deciderLogistique(acteur: Acteur, id: string, dto: DecisionFournitureDto) {
    if (!estGestionnaire(acteur)) throw new ForbiddenException('Seul le responsable logistique valide à ce niveau.');
    this.motifSiRefus(dto);
    const d = await this.source.transaction(async (m) => {
      const d = await this.charger(m, id, true);
      if (d.statut !== StatutDemande.EN_ATTENTE_LOGISTIQUE) {
        throw new ConflictException(`Cette demande n'est pas en attente de la logistique (statut : ${d.statut}).`);
      }
      const statut = dto.decision === DecisionValidation.VALIDEE ? StatutDemande.VALIDEE : StatutDemande.REFUSEE;
      await this.decider(m, d, acteur, NiveauValidation.LOGISTIQUE, dto, statut);
      return d;
    });
    const valide = dto.decision === DecisionValidation.VALIDEE;
    this.notifications.decisionFourniture(this.infosMail(d), valide, 'le responsable logistique', dto.commentaire ?? null);
    if (valide) {
      const magasiniers = (await this.source.getRepository(Utilisateur).find({ where: { actif: true } })).filter((u) =>
        u.roles.includes(Role.MAGASINIER),
      );
      this.notifications.fournitureAPreparer(this.infosMail(d), magasiniers);
    }
    return this.detail(acteur, id);
  }

  /** Le magasinier prend la demande en charge : « En préparation ». */
  async prendreEnCharge(acteur: Acteur, id: string) {
    if (!peutRemettre(acteur)) throw new ForbiddenException('Réservé au magasinier.');
    await this.source.transaction(async (m) => {
      const d = await this.charger(m, id, true);
      if (d.statut !== StatutDemande.VALIDEE) throw new ConflictException(`Cette demande n'est pas à préparer (statut : ${d.statut}).`);
      await this.demandes.changerStatut(m, d, StatutDemande.EN_PREPARATION, acteur.id);
    });
    return this.detail(acteur, id);
  }

  /**
   * Remise des fournitures : quantité réellement livrée par ligne (livraison partielle possible, motif obligatoire),
   * sortie de stock correspondante, bon de sortie numérique, puis e-mail au demandeur.
   * Les articles sont verrouillés (dans un ordre fixe) pour que deux remises simultanées ne vident pas le même stock.
   */
  async remettre(acteur: Acteur, id: string, dto: RemiseDto) {
    if (!peutRemettre(acteur)) throw new ForbiddenException('Réservé au magasinier.');
    await this.source.transaction(async (m) => {
      const d = await this.charger(m, id, true);
      if (d.statut !== StatutDemande.EN_PREPARATION && d.statut !== StatutDemande.VALIDEE) {
        throw new ConflictException(`Cette demande n'est pas à remettre (statut : ${d.statut}).`);
      }
      const saisies = new Map(dto.lignes.map((l) => [l.ligneId, l]));
      if (saisies.size !== d.lignes.length || d.lignes.some((l) => !saisies.has(l.id))) {
        throw new BadRequestException('Indiquez la quantité remise pour chaque article de la demande.');
      }
      const articleIds = [...new Set(d.lignes.map((l) => l.article.id))].sort();
      for (const aid of articleIds) await m.query('SELECT 1 FROM article_stock WHERE id = $1 FOR UPDATE', [aid]);
      const stocks = new Map((await m.findBy(ArticleStock, { id: In(articleIds) })).map((a) => [a.id, a]));

      let total = 0;
      for (const l of d.lignes) {
        const saisie = saisies.get(l.id)!;
        const article = stocks.get(l.article.id)!;
        if (saisie.quantiteLivree > l.quantiteDemandee) {
          throw new BadRequestException(`« ${article.nom} » : on ne remet pas plus que la quantité demandée (${l.quantiteDemandee}).`);
        }
        if (saisie.quantiteLivree > article.quantiteStock) {
          throw new ConflictException(`« ${article.nom} » : il n'en reste que ${article.quantiteStock} en stock.`);
        }
        if (saisie.quantiteLivree < l.quantiteDemandee && !saisie.observations) {
          throw new BadRequestException(`« ${article.nom} » : indiquez pourquoi la livraison est partielle.`);
        }
        total += saisie.quantiteLivree;
        await m.update(LigneFourniture, { id: l.id }, { quantiteLivree: saisie.quantiteLivree, observations: saisie.observations ?? l.observations });
        if (saisie.quantiteLivree > 0) {
          article.quantiteStock -= saisie.quantiteLivree;
          await m.update(ArticleStock, { id: article.id }, { quantiteStock: article.quantiteStock });
          await m.insert(MouvementStock, {
            article: { id: article.id },
            type: TypeMouvement.SORTIE,
            quantite: saisie.quantiteLivree,
            auteur: { id: acteur.id } as Utilisateur,
            ligneFourniture: { id: l.id },
            observation: `Remise ${d.reference}`,
          });
        }
      }
      if (total === 0) throw new BadRequestException('Aucune quantité remise : refusez plutôt la demande ou attendez le réapprovisionnement.');
      await m.insert(BonDeSortie, {
        numero: await this.prochainNumeroBon(m),
        demande: { id: d.id },
        magasinier: { id: acteur.id } as Utilisateur,
      });
      const partielle = d.lignes.some((l) => saisies.get(l.id)!.quantiteLivree < l.quantiteDemandee);
      await this.demandes.changerStatut(m, d, StatutDemande.REMISE, acteur.id, partielle ? 'Livraison partielle' : null);
    });
    const d = await this.charger(this.source.manager, id);
    this.notifications.fournituresRemises(this.infosMail(d), d.lignes.map((l) => ({
      article: l.article.nom, unite: l.article.unite, demandee: l.quantiteDemandee, livree: l.quantiteLivree ?? 0, observations: l.observations,
    })));
    return this.detail(acteur, id);
  }

  /** Bon de sortie d'une demande remise, pour l'affichage imprimable. */
  async bonDeSortie(acteur: Acteur, id: string) {
    const d = await this.charger(this.source.manager, id);
    if (!this.peutVoir(acteur, d)) throw new ForbiddenException("Vous n'avez pas accès à cette demande.");
    const bon = await this.source.getRepository(BonDeSortie).findOne({ where: { demande: { id } }, relations: { magasinier: true } });
    if (!bon) throw new NotFoundException('Aucun bon de sortie : les fournitures ne sont pas encore remises.');
    return {
      numero: bon.numero,
      dateEmission: bon.dateEmission,
      magasinier: bon.magasinier.nomComplet,
      demande: {
        reference: d.reference,
        soumisLe: d.soumisLe,
        demandeur: { nomComplet: d.demandeur.nomComplet, direction: d.demandeur.direction, service: d.demandeur.service },
        observations: d.observations,
      },
      lignes: d.lignes.map((l) => ({
        reference: l.article.reference,
        designation: l.article.nom,
        unite: l.article.unite,
        quantiteDemandee: l.quantiteDemandee,
        quantiteLivree: l.quantiteLivree ?? 0,
        observations: l.observations,
      })),
    };
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

  // ---------------------------------------------------------------- outils

  /** Droit de consulter : celui des demandes (auteur, N+1, assistante, logistique), plus le magasinier pour les demandes validées. */
  private peutVoir(acteur: Acteur, d: DemandeFourniture) {
    return this.demandes.peutVoir(acteur, d.demandeur) || (estMagasinier(acteur) && STATUTS_MAGASIN.includes(d.statut));
  }

  /** BS-2026-0001 : numérotation annuelle, sous verrou pour éviter deux numéros identiques. */
  private async prochainNumeroBon(m: EntityManager): Promise<string> {
    const debut = `BS-${new Date().getFullYear()}-`;
    await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [debut]);
    const [{ dernier }] = await m.query(
      'SELECT max(substring(numero from $2)::int) AS dernier FROM bon_de_sortie WHERE numero LIKE $1',
      [`${debut}%`, `^${debut}(\\d+)$`],
    );
    return `${debut}${String((dernier ?? 0) + 1).padStart(4, '0')}`;
  }

  private motifSiRefus(dto: DecisionFournitureDto) {
    if (dto.decision === DecisionValidation.REFUSEE && !dto.commentaire) {
      throw new BadRequestException('Indiquez le motif du refus : il sera communiqué au demandeur.');
    }
  }

  private async decider(
    m: EntityManager, d: DemandeFourniture, acteur: Acteur, niveau: NiveauValidation, dto: DecisionFournitureDto, statut: StatutDemande,
  ) {
    await m.insert(Validation, {
      demande: { id: d.id },
      niveau,
      decision: dto.decision,
      validateur: { id: acteur.id },
      commentaire: dto.commentaire ?? null,
    });
    await this.demandes.changerStatut(m, d, statut, acteur.id, dto.commentaire ?? null);
  }

  private infosMail(d: DemandeFourniture): FournitureMail {
    return {
      reference: d.reference,
      demandeur: { nomComplet: d.demandeur.nomComplet, email: d.demandeur.email },
      dateBesoin: d.dateBesoin,
      observations: d.observations,
      lignes: d.lignes.map((l) => ({ article: l.article.nom, unite: l.article.unite, quantite: l.quantiteDemandee })),
    };
  }

  private requete() {
    return this.source
      .getRepository(DemandeFourniture)
      .createQueryBuilder('d')
      .innerJoinAndSelect('d.demandeur', 'demandeur')
      .leftJoinAndSelect('d.lignes', 'ligne')
      .leftJoinAndSelect('ligne.article', 'article')
      .orderBy('d.soumisLe', 'DESC')
      .addOrderBy('ligne.ordre', 'ASC');
  }

  private async charger(m: EntityManager, id: string, verrouiller = false): Promise<DemandeFourniture> {
    if (verrouiller) await m.query('SELECT 1 FROM demande WHERE id = $1 FOR UPDATE', [id]);
    const d = await m.getRepository(DemandeFourniture).findOne({
      where: { id },
      relations: { demandeur: true, lignes: { article: true } },
      order: { lignes: { ordre: 'ASC' } },
    });
    if (!d) throw new NotFoundException('Demande de fournitures introuvable.');
    return d;
  }

  /** Ce que l'API renvoie d'une demande, avec les actions permises à l'utilisateur. */
  private resume(d: DemandeFourniture, acteur: Acteur) {
    const auteur = d.demandeurId === acteur.id;
    // Le niveau de stock n'est montré qu'à ceux qui décident ou préparent
    const voitStock = estGestionnaire(acteur) || estMagasinier(acteur);
    return {
      id: d.id,
      reference: d.reference,
      statut: d.statut,
      dateBesoin: d.dateBesoin,
      observations: d.observations,
      soumisLe: d.soumisLe,
      demandeur: { id: d.demandeur.id, nomComplet: d.demandeur.nomComplet, direction: d.demandeur.direction, service: d.demandeur.service },
      lignes: (d.lignes ?? [])
        .slice()
        .sort((a, b) => a.ordre - b.ordre)
        .map((l) => ({
          id: l.id,
          article: { id: l.article.id, reference: l.article.reference, designation: l.article.nom, unite: l.article.unite },
          quantiteDemandee: l.quantiteDemandee,
          quantiteLivree: l.quantiteLivree,
          observations: l.observations,
          enStock: voitStock ? l.article.quantiteStock : null,
        })),
      actions: {
        deciderN1: d.demandeur.superieurDirectId === acteur.id && d.statut === StatutDemande.EN_ATTENTE_N1,
        deciderLogistique: estGestionnaire(acteur) && d.statut === StatutDemande.EN_ATTENTE_LOGISTIQUE,
        prendreEnCharge: peutRemettre(acteur) && d.statut === StatutDemande.VALIDEE,
        remettre: peutRemettre(acteur) && (d.statut === StatutDemande.VALIDEE || d.statut === StatutDemande.EN_PREPARATION),
        bonDeSortie: d.statut === StatutDemande.REMISE,
        annuler: (auteur || estGestionnaire(acteur)) && ANNULABLES.includes(d.statut),
      },
    };
  }
}
