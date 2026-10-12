import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Parametre } from './entities/parametre.entity';
import { ParametresService } from './parametres.service';

/** Réglages de la plateforme (clé / valeur). */
@Module({
  imports: [TypeOrmModule.forFeature([Parametre])],
  providers: [ParametresService],
  exports: [ParametresService],
})
export class ParametresModule {}
