import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Salle } from './entities/salle.entity';
import { SalleDto } from './dto/salle.dto';

/** Ce que l'API renvoie d'une salle : ses équipements en service, par nom. */
export type SalleVue = Omit<Salle, 'equipementsLies'> & { equipements: string[] };

export const vueSalle = (s: Salle): SalleVue => {
  const { equipementsLies, ...reste } = s;
  return {
    ...reste,
    equipements: (equipementsLies ?? [])
      .filter((e) => e.actif)
      .map((e) => e.nom)
      .sort((a, b) => a.localeCompare(b, 'fr')),
  };
};

/** Référentiel des salles de réunion (Salle 1, Salle 2…). */
@Injectable()
export class SallesRessourceService {
  constructor(@InjectRepository(Salle) private readonly depot: Repository<Salle>) {}

  /** Salles en service d'abord, par nom. `seulementActives` : pour le formulaire de réservation. */
  async lister(seulementActives = false): Promise<SalleVue[]> {
    const liste = await this.depot.find({
      where: seulementActives ? { actif: true } : {},
      relations: { equipementsLies: true },
      order: { actif: 'DESC', nom: 'ASC' },
    });
    return liste.map(vueSalle);
  }

  async trouver(id: string): Promise<Salle> {
    const s = await this.depot.findOne({ where: { id }, relations: { equipementsLies: true } });
    if (!s) throw new NotFoundException('Salle introuvable.');
    return s;
  }

  async creer(dto: SalleDto): Promise<SalleVue> {
    await this.verifierNomLibre(dto.nom);
    const s = await this.depot.save(this.depot.create({ ...dto, localisation: dto.localisation ?? null, actif: dto.actif ?? true }));
    return vueSalle({ ...s, equipementsLies: [] } as Salle);
  }

  async modifier(id: string, dto: SalleDto): Promise<SalleVue> {
    const s = await this.trouver(id);
    if (dto.nom.toLowerCase() !== s.nom.toLowerCase()) await this.verifierNomLibre(dto.nom);
    Object.assign(s, dto, { localisation: dto.localisation ?? null, actif: dto.actif ?? s.actif });
    return vueSalle(await this.depot.save(s));
  }

  /** Suppression définitive, refusée si la salle a déjà des réservations (la mettre hors service à la place). */
  async supprimer(id: string): Promise<void> {
    const s = await this.trouver(id);
    const [{ n }] = await this.depot.query('SELECT count(*)::int AS n FROM demande WHERE salle_id = $1', [id]);
    if (n > 0) {
      throw new ConflictException(
        `« ${s.nom} » a déjà ${n} réservation(s) : elle ne peut pas être supprimée. Mettez-la hors service à la place.`,
      );
    }
    await this.depot.remove(s);
  }

  private async verifierNomLibre(nom: string) {
    if (await this.depot.createQueryBuilder('s').where('lower(s.nom) = lower(:nom)', { nom }).getExists()) {
      throw new ConflictException(`Une salle nommée « ${nom} » existe déjà.`);
    }
  }
}
