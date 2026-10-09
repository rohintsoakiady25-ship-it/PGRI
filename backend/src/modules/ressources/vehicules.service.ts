import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Disponibilite, EtatTechnique } from '../../common/enums/etat-technique.enum';
import { Vehicule } from './entities/vehicule.entity';
import { FiltreVehiculesDto, VehiculeDto } from './dto/vehicule.dto';

export type VehiculeAvecDisponibilite = Vehicule & { disponibilite: Disponibilite };

@Injectable()
export class VehiculesService {
  constructor(@InjectRepository(Vehicule) private readonly depot: Repository<Vehicule>) {}

  /** Disponibilité calculée ; les missions en cours s'ajouteront avec les affectations. */
  private disponibilite(v: Vehicule): Disponibilite {
    if (!v.actif) return Disponibilite.HORS_SERVICE;
    if (v.etatTechnique === EtatTechnique.EN_REPARATION) return Disponibilite.INDISPONIBLE;
    return Disponibilite.DISPONIBLE;
  }

  async lister(filtres: FiltreVehiculesDto): Promise<VehiculeAvecDisponibilite[]> {
    const qb = this.depot.createQueryBuilder('v').orderBy('v.actif', 'DESC').addOrderBy('v.immatriculation', 'ASC');
    if (filtres.q?.trim()) {
      qb.andWhere('(v.immatriculation ILIKE :q OR v.marqueModele ILIKE :q)', { q: `%${filtres.q.trim()}%` });
    }
    if (filtres.etat) qb.andWhere('v.etatTechnique = :etat', { etat: filtres.etat });
    const vehicules = await qb.getMany();
    return vehicules.map((v) => ({ ...v, disponibilite: this.disponibilite(v) }));
  }

  async creer(dto: VehiculeDto): Promise<VehiculeAvecDisponibilite> {
    await this.verifierImmatriculationLibre(dto.immatriculation);
    const v = this.depot.create({ ...dto, nom: `${dto.marqueModele} — ${dto.immatriculation}`, actif: dto.actif ?? true });
    const enregistre = await this.depot.save(v);
    return { ...enregistre, disponibilite: this.disponibilite(enregistre) };
  }

  async modifier(id: string, dto: VehiculeDto): Promise<VehiculeAvecDisponibilite> {
    const v = await this.depot.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Véhicule introuvable.');
    if (dto.immatriculation !== v.immatriculation) await this.verifierImmatriculationLibre(dto.immatriculation);
    Object.assign(v, dto, { nom: `${dto.marqueModele} — ${dto.immatriculation}`, actif: dto.actif ?? v.actif });
    const enregistre = await this.depot.save(v);
    return { ...enregistre, disponibilite: this.disponibilite(enregistre) };
  }

  /** Suppression définitive (l'administrateur peut aussi le mettre hors service sans le supprimer). */
  async supprimer(id: string): Promise<void> {
    const v = await this.depot.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Véhicule introuvable.');
    await this.depot.remove(v);
  }

  private async verifierImmatriculationLibre(immatriculation: string) {
    if (await this.depot.exists({ where: { immatriculation } })) {
      throw new ConflictException(`Un véhicule immatriculé « ${immatriculation} » existe déjà.`);
    }
  }
}
