import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicule } from './entities/vehicule.entity';
import { VehiculesController } from './vehicules.controller';
import { VehiculesService } from './vehicules.service';

/** Ressource abstraite et ses sous-types : véhicule (fait), salle et article de stock (à venir). */
@Module({
  imports: [TypeOrmModule.forFeature([Vehicule])],
  controllers: [VehiculesController],
  providers: [VehiculesService],
  exports: [VehiculesService],
})
export class RessourcesModule {}
