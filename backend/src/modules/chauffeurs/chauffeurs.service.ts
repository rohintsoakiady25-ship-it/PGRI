import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Disponibilite } from '../../common/enums/etat-technique.enum';
import { MissionResume, missionsDe, Occupation, occupations } from '../deplacements/occupations';
import { Chauffeur } from './entities/chauffeur.entity';
import { ChauffeurDto, FiltreChauffeursDto } from './dto/chauffeur.dto';

export type ChauffeurAvecDisponibilite = Chauffeur & {
  disponibilite: Disponibilite;
  mission: MissionResume | null;
  prochaineMission: MissionResume | null;
};

@Injectable()
export class ChauffeursService {
  constructor(@InjectRepository(Chauffeur) private readonly depot: Repository<Chauffeur>) {}

  /** Disponibilité aujourd'hui : hors service, en mission ou disponible. */
  private avecDisponibilite(c: Chauffeur, o?: Occupation): ChauffeurAvecDisponibilite {
    const disponibilite = !c.actif ? Disponibilite.HORS_SERVICE : o?.actuelle ? Disponibilite.EN_MISSION : Disponibilite.DISPONIBLE;
    return { ...c, disponibilite, mission: o?.actuelle ?? null, prochaineMission: o?.prochaine ?? null };
  }

  async lister(filtres: FiltreChauffeursDto): Promise<ChauffeurAvecDisponibilite[]> {
    const qb = this.depot.createQueryBuilder('c').orderBy('c.actif', 'DESC').addOrderBy('c.nomComplet', 'ASC');
    if (filtres.q?.trim()) {
      qb.andWhere('(c.nomComplet ILIKE :q OR c.matricule ILIKE :q OR c.telephone ILIKE :q OR c.numeroPermis ILIKE :q)', { q: `%${filtres.q.trim()}%` });
    }
    const [chauffeurs, occ] = await Promise.all([qb.getMany(), occupations(this.depot.manager, 'chauffeurId')]);
    return chauffeurs.map((c) => this.avecDisponibilite(c, occ.get(c.id)));
  }

  async creer(dto: ChauffeurDto): Promise<ChauffeurAvecDisponibilite> {
    await this.verifierMatriculeLibre(dto.matricule);
    if (dto.numeroPermis) await this.verifierPermisLibre(dto.numeroPermis);
    const c = this.depot.create({ ...dto, telephone: dto.telephone ?? null, numeroPermis: dto.numeroPermis ?? null, actif: dto.actif ?? true });
    return this.avecDisponibilite(await this.depot.save(c));
  }

  async modifier(id: string, dto: ChauffeurDto): Promise<ChauffeurAvecDisponibilite> {
    const c = await this.depot.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Chauffeur introuvable.');
    if (dto.matricule !== c.matricule) await this.verifierMatriculeLibre(dto.matricule);
    if (dto.numeroPermis && dto.numeroPermis !== c.numeroPermis) await this.verifierPermisLibre(dto.numeroPermis);
    Object.assign(c, dto, { telephone: dto.telephone ?? null, numeroPermis: dto.numeroPermis ?? null, actif: dto.actif ?? c.actif });
    return this.avecDisponibilite(await this.depot.save(c));
  }

  /** Suppression définitive (l'administrateur peut aussi le mettre hors service sans le supprimer). */
  /** Missions à venir et historique des déplacements du chauffeur. */
  async missions(id: string) {
    if (!(await this.depot.exists({ where: { id } }))) throw new NotFoundException('Chauffeur introuvable.');
    return missionsDe(this.depot.manager, 'chauffeurId', id);
  }

  async supprimer(id: string): Promise<void> {
    const c = await this.depot.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Chauffeur introuvable.');
    const [{ n }] = await this.depot.query('SELECT count(*)::int AS n FROM affectation WHERE chauffeur_id = $1', [id]);
    if (n > 0) throw new ConflictException(`${c.nomComplet} a déjà des missions : mettez-le hors service plutôt que de le supprimer.`);
    await this.depot.remove(c);
  }

  private async verifierMatriculeLibre(matricule: string) {
    if (await this.depot.exists({ where: { matricule } })) {
      throw new ConflictException(`Un chauffeur avec le matricule « ${matricule} » existe déjà.`);
    }
  }

  private async verifierPermisLibre(numeroPermis: string) {
    if (await this.depot.exists({ where: { numeroPermis } })) {
      throw new ConflictException(`Un chauffeur avec le permis « ${numeroPermis} » existe déjà.`);
    }
  }
}
