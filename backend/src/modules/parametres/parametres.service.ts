import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parametre } from './entities/parametre.entity';

/** Lecture et écriture des réglages clé / valeur. */
@Injectable()
export class ParametresService {
  constructor(@InjectRepository(Parametre) private readonly depot: Repository<Parametre>) {}

  async lire(cle: string): Promise<Parametre | null> {
    return this.depot.findOne({ where: { cle } });
  }

  async ecrire(cle: string, valeur: string): Promise<Parametre> {
    return this.depot.save(this.depot.create({ cle, valeur }));
  }
}
