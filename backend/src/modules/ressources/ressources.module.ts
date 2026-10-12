import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Salle } from './entities/salle.entity';
import { Vehicule } from './entities/vehicule.entity';
import { SallesRessourceController } from './salles-ressource.controller';
import { SallesRessourceService } from './salles-ressource.service';
import { VehiculesController } from './vehicules.controller';
import { VehiculesService } from './vehicules.service';

/** Ressource abstraite et ses sous-types : véhicule et salle (faits), article de stock (à venir). */
@Module({
  imports: [TypeOrmModule.forFeature([Vehicule, Salle])],
  controllers: [VehiculesController, SallesRessourceController],
  providers: [VehiculesService, SallesRessourceService],
  exports: [VehiculesService, SallesRessourceService],
})
export class RessourcesModule {}
