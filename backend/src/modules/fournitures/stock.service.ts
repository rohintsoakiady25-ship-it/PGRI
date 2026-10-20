import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ArticleStock } from '../ressources/entities/article-stock.entity';
import { Utilisateur } from '../utilisateurs/entities/utilisateur.entity';
import { ArticleStockDto, EntreeStockDto } from './dto/article-stock.dto';
import { MouvementStock, TypeMouvement } from './entities/mouvement-stock.entity';

export type EtatStock = 'RUPTURE' | 'BAS' | 'OK';

/** Ce que l'API renvoie d'un article (vue logistique). */
export interface ArticleVue {
  id: string;
  reference: string;
  designation: string;
  unite: string;
  categorie: string | null;
  quantiteStock: number;
  seuilAlerte: number;
  fournisseur: string | null;
  actif: boolean;
  etat: EtatStock;
}

/** Article proposé dans le formulaire de demande (sans le niveau de stock). */
export interface ArticleCatalogue {
  id: string;
  reference: string;
  designation: string;
  unite: string;
  categorie: string | null;
}

export interface EntreeVue {
  id: string;
  date: Date;
  article: { id: string; reference: string; designation: string; unite: string };
  quantite: number;
  observation: string | null;
  auteur: string;
}

const PREFIXE = 'ART-';

/** Catalogue du magasin et mouvements de stock (réception, inventaire). */
@Injectable()
export class StockService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async lister(): Promise<ArticleVue[]> {
    const liste = await this.ds.getRepository(ArticleStock).find({ order: { actif: 'DESC', categorie: 'ASC', nom: 'ASC' } });
    return liste.map((a) => this.vue(a));
  }

  async catalogue(): Promise<ArticleCatalogue[]> {
    const liste = await this.ds.getRepository(ArticleStock).find({ where: { actif: true }, order: { categorie: 'ASC', nom: 'ASC' } });
    return liste.map((a) => ({ id: a.id, reference: a.reference, designation: a.nom, unite: a.unite, categorie: a.categorie }));
  }

  async dernieresEntrees(limite: number): Promise<EntreeVue[]> {
    const liste = await this.ds.getRepository(MouvementStock).find({
      where: { type: TypeMouvement.ENTREE },
      relations: { article: true, auteur: true },
      order: { date: 'DESC' },
      take: limite,
    });
    return liste.map((m) => ({
      id: m.id,
      date: m.date,
      article: { id: m.article.id, reference: m.article.reference, designation: m.article.nom, unite: m.article.unite },
      quantite: m.quantite,
      observation: m.observation,
      auteur: m.auteur.nomComplet,
    }));
  }

  /**
   * Réception : chaque ligne augmente le stock d'un article existant, ou crée l'article
   * (une désignation déjà au catalogue, aux majuscules près, réutilise l'article existant).
   */
  async entrer(auteurId: string, dto: EntreeStockDto): Promise<ArticleVue[]> {
    const observation = [dto.fournisseur && `Fournisseur : ${dto.fournisseur}`, dto.observation].filter(Boolean).join(' — ') || null;
    return this.ds.transaction(async (m) => {
      // Un seul ajout d'articles à la fois : références et désignations restent uniques
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [PREFIXE]);
      const touches = new Map<string, ArticleStock>();
      for (const l of dto.lignes) {
        let article = l.articleId
          ? await m.findOne(ArticleStock, { where: { id: l.articleId }, lock: { mode: 'pessimistic_write' } })
          : await this.parDesignation(m, l.designation!);
        if (l.articleId && !article) throw new NotFoundException('Un des articles choisis n’existe plus.');
        if (!article) {
          article = m.create(ArticleStock, {
            reference: await this.prochaineReference(m),
            nom: l.designation!,
            unite: l.unite!,
            categorie: l.categorie ?? null,
            quantiteStock: 0,
            seuilAlerte: 0,
            fournisseur: null,
            actif: true,
          });
        }
        article.quantiteStock += l.quantite;
        article.actif = true; // une réception remet l'article au catalogue
        if (dto.fournisseur) article.fournisseur = dto.fournisseur;
        article = await m.save(article);
        await m.insert(MouvementStock, {
          article: { id: article.id },
          type: TypeMouvement.ENTREE,
          quantite: l.quantite,
          auteur: { id: auteurId } as Utilisateur,
          observation,
        });
        touches.set(article.id, article);
      }
      return [...touches.values()].map((a) => this.vue(a));
    });
  }

  /** Modifie la fiche ; un stock compté différent du stock enregistré crée un ajustement. */
  async modifier(auteurId: string, id: string, dto: ArticleStockDto): Promise<ArticleVue> {
    return this.ds.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [PREFIXE]);
      const a = await m.findOne(ArticleStock, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!a) throw new NotFoundException('Article introuvable.');
      const homonyme = await this.parDesignation(m, dto.designation);
      if (homonyme && homonyme.id !== id) {
        throw new ConflictException(`« ${homonyme.nom} » est déjà au catalogue (${homonyme.reference}).`);
      }
      Object.assign(a, {
        nom: dto.designation,
        unite: dto.unite,
        categorie: dto.categorie ?? null,
        seuilAlerte: dto.seuilAlerte,
        fournisseur: dto.fournisseur ?? null,
        actif: dto.actif ?? a.actif,
      });
      const ecart = dto.stockCompte === undefined ? 0 : dto.stockCompte - a.quantiteStock;
      if (ecart !== 0) {
        a.quantiteStock = dto.stockCompte!;
        await m.insert(MouvementStock, {
          article: { id },
          type: TypeMouvement.AJUSTEMENT,
          quantite: ecart,
          auteur: { id: auteurId } as Utilisateur,
          observation: 'Inventaire : stock compté',
        });
      }
      return this.vue(await m.save(a));
    });
  }

  /** Un article déjà remis à des demandeurs reste dans l'historique : on le retire du catalogue. */
  async supprimer(id: string): Promise<void> {
    const a = await this.ds.getRepository(ArticleStock).findOneBy({ id });
    if (!a) throw new NotFoundException('Article introuvable.');
    const remis = await this.ds.getRepository(MouvementStock).exists({ where: { article: { id }, type: TypeMouvement.SORTIE } });
    const [{ n }] = await this.ds.query('SELECT count(*)::int AS n FROM ligne_fourniture WHERE article_id = $1', [id]);
    if (remis || n > 0) {
      throw new ConflictException('Cet article figure déjà dans des demandes : décochez « Proposé aux demandeurs » plutôt que de le supprimer.');
    }
    await this.ds.getRepository(ArticleStock).remove(a); // ses entrées et ajustements partent avec lui
  }

  private parDesignation(m: EntityManager, designation: string) {
    return m
      .createQueryBuilder(ArticleStock, 'a')
      .where('lower(a.nom) = lower(:d)', { d: designation })
      .getOne();
  }

  private async prochaineReference(m: EntityManager): Promise<string> {
    const [{ dernier }] = await m.query(
      'SELECT max(substring(reference from $2)::int) AS dernier FROM article_stock WHERE reference LIKE $1',
      [`${PREFIXE}%`, `^${PREFIXE}(\\d+)$`],
    );
    return `${PREFIXE}${String((dernier ?? 0) + 1).padStart(4, '0')}`;
  }

  private vue(a: ArticleStock): ArticleVue {
    const etat: EtatStock = a.quantiteStock === 0 ? 'RUPTURE' : a.quantiteStock <= a.seuilAlerte ? 'BAS' : 'OK';
    return {
      id: a.id,
      reference: a.reference,
      designation: a.nom,
      unite: a.unite,
      categorie: a.categorie,
      quantiteStock: a.quantiteStock,
      seuilAlerte: a.seuilAlerte,
      fournisseur: a.fournisseur,
      actif: a.actif,
      etat,
    };
  }
}
