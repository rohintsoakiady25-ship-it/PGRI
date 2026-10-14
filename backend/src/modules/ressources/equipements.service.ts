import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EquipementDto } from './dto/equipement.dto';
import { Equipement } from './entities/equipement.entity';
import { Salle } from './entities/salle.entity';

/** Ce que l'API renvoie d'un équipement. */
export interface EquipementVue {
  id: string;
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
    const liste = await this.depot.find({ relations: { salles: true }, order: { actif: 'DESC', nom: 'ASC' } });
    return liste.map((e) => this.vue(e));
  }

  async creer(dto: EquipementDto): Promise<EquipementVue> {
    await this.verifierNomLibre(dto.nom);
    const e = this.depot.create({
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
    if (dto.nom.toLowerCase() !== e.nom.toLowerCase()) await this.verifierNomLibre(dto.nom);
    Object.assign(e, {
      nom: dto.nom,
      description: dto.description ?? null,
      plusieursSalles: dto.plusieursSalles,
      actif: dto.actif ?? e.actif,
      salles: await this.sallesValides(dto),
    });
    return this.vue(await this.depot.save(e));
  }

  /** Les réservations passées gardent le nom de l'équipement demandé : la suppression ne les modifie pas. */
  async supprimer(id: string): Promise<void> {
    await this.depot.remove(await this.trouver(id));
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

  private async verifierNomLibre(nom: string) {
    if (await this.depot.createQueryBuilder('e').where('lower(e.nom) = lower(:nom)', { nom }).getExists()) {
      throw new ConflictException(`Un équipement nommé « ${nom} » existe déjà.`);
    }
  }

  private vue(e: Equipement): EquipementVue {
    return {
      id: e.id,
      nom: e.nom,
      description: e.description,
      plusieursSalles: e.plusieursSalles,
      actif: e.actif,
      salles: (e.salles ?? []).map((s) => ({ id: s.id, nom: s.nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    };
  }
}
