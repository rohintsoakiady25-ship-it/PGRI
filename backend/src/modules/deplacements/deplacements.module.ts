import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemandesModule } from '../demandes/demandes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UtilisateursModule } from '../utilisateurs/utilisateurs.module';
import { DemandesDeplacementController } from './demandes-deplacement.controller';
import { DemandesDeplacementService } from './demandes-deplacement.service';
import { AffectationsService } from './affectations.service';
import { Affectation } from './entities/affectation.entity';
import { DemandeDeplacement } from './entities/demande-deplacement.entity';

/** Demandes de déplacement : validation N+1 puis logistique, affectation véhicule/chauffeur. */
@Module({
  imports: [TypeOrmModule.forFeature([DemandeDeplacement, Affectation]), DemandesModule, UtilisateursModule, NotificationsModule],
  controllers: [DemandesDeplacementController],
  providers: [DemandesDeplacementService, AffectationsService],
})
export class DeplacementsModule {}
