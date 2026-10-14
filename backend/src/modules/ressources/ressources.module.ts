import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipement } from './entities/equipement.entity';
import { Salle } from './entities/salle.entity';
import { EquipementsController } from './equipements.controller';
import { EquipementsService } from './equipements.service';
import { Vehicule } from './entities/vehicule.entity';
import { SallesRessourceController } from './salles-ressource.controller';
import { SallesRessourceService } from './salles-ressource.service';
import { VehiculesController } from './vehicules.controller';
import { VehiculesService } from './vehicules.service';

/** Ressource abstraite et ses sous-types : véhicule et salle (avec ses équipements), article de stock (à venir). */
@Module({
  imports: [TypeOrmModule.forFeature([Vehicule, Salle, Equipement])],
  controllers: [VehiculesController, SallesRessourceController, EquipementsController],
  providers: [VehiculesService, SallesRessourceService, EquipementsService],
  exports: [VehiculesService, SallesRessourceService, EquipementsService],
})
export class RessourcesModule {}
