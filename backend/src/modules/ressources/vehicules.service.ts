import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Disponibilite, EtatTechnique } from '../../common/enums/etat-technique.enum';
import { historiqueDe, MissionResume, missionsDe, Occupation, occupations } from '../deplacements/occupations';
import { Vehicule } from './entities/vehicule.entity';
import { FiltreVehiculesDto, VehiculeDto } from './dto/vehicule.dto';

const FUSEAU = 'Indian/Antananarivo';
const aujourdhui = () => new Intl.DateTimeFormat('fr-CA', { timeZone: FUSEAU }).format(new Date()); // AAAA-MM-JJ

export type VehiculeAvecDisponibilite = Vehicule & {
  disponibilite: Disponibilite;
  /** Raison d'une indisponibilité (réparation, assurance ou visite expirée). */
  motif: string | null;
  mission: MissionResume | null;
  prochaineMission: MissionResume | null;
};

@Injectable()
export class VehiculesService {
  constructor(@InjectRepository(Vehicule) private readonly depot: Repository<Vehicule>) {}

  /** Disponibilité aujourd'hui : hors service, en mission, indisponible (avec le motif) ou disponible. */
  private avecDisponibilite(v: Vehicule, o: Occupation | undefined): VehiculeAvecDisponibilite {
    const jour = aujourdhui();
    let disponibilite = Disponibilite.DISPONIBLE;
    let motif: string | null = null;
    if (!v.actif) disponibilite = Disponibilite.HORS_SERVICE;
    else if (o?.actuelle) disponibilite = Disponibilite.EN_MISSION;
    else if (v.etatTechnique === EtatTechnique.EN_REPARATION) [disponibilite, motif] = [Disponibilite.INDISPONIBLE, 'En réparation'];
    else if (v.assuranceFin && v.assuranceFin < jour) [disponibilite, motif] = [Disponibilite.INDISPONIBLE, 'Assurance expirée'];
    else if (v.visiteTechniqueFin && v.visiteTechniqueFin < jour) [disponibilite, motif] = [Disponibilite.INDISPONIBLE, 'Visite technique expirée'];
    return { ...v, disponibilite, motif, mission: o?.actuelle ?? null, prochaineMission: o?.prochaine ?? null };
  }

  private async unSeul(v: Vehicule): Promise<VehiculeAvecDisponibilite> {
    return this.avecDisponibilite(v, (await occupations(this.depot.manager, 'vehiculeId')).get(v.id));
  }

  async lister(filtres: FiltreVehiculesDto): Promise<VehiculeAvecDisponibilite[]> {
    const qb = this.depot.createQueryBuilder('v').orderBy('v.actif', 'DESC').addOrderBy('v.immatriculation', 'ASC');
    if (filtres.q?.trim()) {
      qb.andWhere('(v.immatriculation ILIKE :q OR v.marqueModele ILIKE :q)', { q: `%${filtres.q.trim()}%` });
    }
    if (filtres.etat) qb.andWhere('v.etatTechnique = :etat', { etat: filtres.etat });
    const [vehicules, occ] = await Promise.all([qb.getMany(), occupations(this.depot.manager, 'vehiculeId')]);
    return vehicules.map((v) => this.avecDisponibilite(v, occ.get(v.id)));
  }

  async creer(dto: VehiculeDto): Promise<VehiculeAvecDisponibilite> {
    await this.verifierImmatriculationLibre(dto.immatriculation);
    const v = this.depot.create({ ...this.valeurs(dto), actif: dto.actif ?? true });
    const enregistre = await this.depot.save(v);
    return this.unSeul(enregistre);
  }

  async modifier(id: string, dto: VehiculeDto): Promise<VehiculeAvecDisponibilite> {
    const v = await this.depot.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Véhicule introuvable.');
    if (dto.immatriculation !== v.immatriculation) await this.verifierImmatriculationLibre(dto.immatriculation);
    Object.assign(v, this.valeurs(dto), { actif: dto.actif ?? v.actif });
    const enregistre = await this.depot.save(v);
    return this.unSeul(enregistre);
  }

  /** Missions à venir et historique des déplacements du véhicule. */
  async missions(id: string) {
    if (!(await this.depot.exists({ where: { id } }))) throw new NotFoundException('Véhicule introuvable.');
    return missionsDe(this.depot.manager, 'vehiculeId', id);
  }

  /** Historique complet des déplacements du véhicule. */
  async historique(id: string) {
    const v = await this.depot.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Véhicule introuvable.');
    return { vehicule: { id: v.id, immatriculation: v.immatriculation, marqueModele: v.marqueModele }, missions: await historiqueDe(this.depot.manager, 'vehiculeId', id) };
  }

  /** Suppression définitive (l'administrateur peut aussi le mettre hors service sans le supprimer). */
  async supprimer(id: string): Promise<void> {
    const v = await this.depot.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Véhicule introuvable.');
    const [{ n }] = await this.depot.query('SELECT count(*)::int AS n FROM affectation WHERE vehicule_id = $1', [id]);
    if (n > 0) throw new ConflictException(`${v.immatriculation} a déjà des missions : mettez-le hors service plutôt que de le supprimer.`);
    await this.depot.remove(v);
  }

  /** Valeurs enregistrées : champs facultatifs à null, périodes vérifiées, libellé recalculé. */
  private valeurs(dto: VehiculeDto) {
    const periode = (debut: string | null | undefined, fin: string | null | undefined, quoi: string) => {
      if (debut && fin && fin < debut) throw new BadRequestException(`La fin de ${quoi} est antérieure à son début.`);
      return [debut ?? null, fin ?? null] as const;
    };
    const [assuranceDebut, assuranceFin] = periode(dto.assuranceDebut, dto.assuranceFin, "l'assurance");
    const [visiteTechniqueDebut, visiteTechniqueFin] = periode(dto.visiteTechniqueDebut, dto.visiteTechniqueFin, 'la visite technique');
    return {
      immatriculation: dto.immatriculation,
      marqueModele: dto.marqueModele ?? null,
      nbPlaces: dto.nbPlaces ?? null,
      etatTechnique: dto.etatTechnique,
      assuranceDebut,
      assuranceFin,
      visiteTechniqueDebut,
      visiteTechniqueFin,
      nom: dto.marqueModele ? `${dto.marqueModele} — ${dto.immatriculation}` : dto.immatriculation,
    };
  }

  private async verifierImmatriculationLibre(immatriculation: string) {
    if (await this.depot.exists({ where: { immatriculation } })) {
      throw new ConflictException(`Un véhicule immatriculé « ${immatriculation} » existe déjà.`);
    }
  }
}
