import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemandesModule } from '../demandes/demandes.module';
import { ParametresModule } from '../parametres/parametres.module';
import { UtilisateursModule } from '../utilisateurs/utilisateurs.module';
import { DemandesSalleController } from './demandes-salle.controller';
import { DemandesSalleService } from './demandes-salle.service';
import { DemandeSalle } from './entities/demande-salle.entity';
import { LienPublicController, PlanningPublicController } from './planning-public.controller';
import { PlanningPublicService } from './planning-public.service';

/**
 * Demandes de salle : validation logistique, commentaires du N+1 et de l'assistante de direction,
 * planning public consultable par QR code.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DemandeSalle]), DemandesModule, UtilisateursModule, ParametresModule],
  controllers: [DemandesSalleController, LienPublicController, PlanningPublicController],
  providers: [DemandesSalleService, PlanningPublicService],
})
export class SallesModule {}
