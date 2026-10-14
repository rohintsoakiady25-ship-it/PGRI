import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EquipementDto } from './dto/equipement.dto';
import { Equipement } from './entities/equipement.entity';
import { Salle } from './entities/salle.entity';

/** Ce que l'API renvoie d'un équipement. */
export interface EquipementVue {
  id: string;
  reference: string;
  nom: string;
  description: string | null;
  plusieursSalles: boolean;
  actif: boolean;
  salles: { id: string; nom: string }[];
}

/** Matériel des salles (logistique, administrateur). */
@Injectable()
export class EquipementsService {
  constructor(
    @InjectRepository(Equipement) private readonly depot: Repository<Equipement>,
    @InjectRepository(Salle) private readonly salles: Repository<Salle>,
  ) {}

  async lister(): Promise<EquipementVue[]> {
    const liste = await this.depot.find({ relations: { salles: true }, order: { actif: 'DESC', nom: 'ASC', reference: 'ASC' } });
    return liste.map((e) => this.vue(e));
  }

  async creer(dto: EquipementDto): Promise<EquipementVue> {
    await this.verifierReferenceLibre(dto.reference);
    const e = this.depot.create({
      reference: dto.reference,
      nom: dto.nom,
      description: dto.description ?? null,
      plusieursSalles: dto.plusieursSalles,
      actif: dto.actif ?? true,
      salles: await this.sallesValides(dto),
    });
    return this.vue(await this.depot.save(e));
  }

  async modifier(id: string, dto: EquipementDto): Promise<EquipementVue> {
    const e = await this.trouver(id);
    if (dto.reference !== e.reference) await this.verifierReferenceLibre(dto.reference);
    Object.assign(e, {
      reference: dto.reference,
      nom: dto.nom,
      description: dto.description ?? null,
      plusieursSalles: dto.plusieursSalles,
      actif: dto.actif ?? e.actif,
      salles: await this.sallesValides(dto),
    });
    return this.vue(await this.depot.save(e));
  }

  /** Les réservations gardent le nom du matériel demandé ; seul le lien vers l'appareil supprimé disparaît. */
  async supprimer(id: string): Promise<void> {
    const e = await this.trouver(id);
    await this.depot.manager.transaction(async (m) => {
      await m.query('DELETE FROM demande_equipement WHERE equipement_id = $1', [id]);
      await m.remove(e);
    });
  }

  /** Salles existantes, et une seule si l'équipement n'est pas partagé. */
  private async sallesValides(dto: EquipementDto): Promise<Salle[]> {
    if (!dto.plusieursSalles && dto.salleIds.length > 1) {
      throw new BadRequestException('Cet équipement est réservé à une seule salle : n’en choisissez qu’une.');
    }
    const salles = await this.salles.findBy({ id: In(dto.salleIds) });
    if (salles.length !== dto.salleIds.length) throw new BadRequestException('Une des salles choisies n’existe pas.');
    return salles;
  }

  private async trouver(id: string): Promise<Equipement> {
    const e = await this.depot.findOne({ where: { id }, relations: { salles: true } });
    if (!e) throw new NotFoundException('Équipement introuvable.');
    return e;
  }

  private async verifierReferenceLibre(reference: string) {
    if (await this.depot.exists({ where: { reference } })) {
      throw new ConflictException(`La référence « ${reference} » est déjà attribuée à un autre équipement.`);
    }
  }

  private vue(e: Equipement): EquipementVue {
    return {
      id: e.id,
      reference: e.reference,
      nom: e.nom,
      description: e.description,
      plusieursSalles: e.plusieursSalles,
      actif: e.actif,
      salles: (e.salles ?? []).map((s) => ({ id: s.id, nom: s.nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    };
  }
}
