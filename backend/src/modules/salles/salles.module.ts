import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemandesModule } from '../demandes/demandes.module';
import { UtilisateursModule } from '../utilisateurs/utilisateurs.module';
import { DemandesSalleController } from './demandes-salle.controller';
import { DemandesSalleService } from './demandes-salle.service';
import { DemandeSalle } from './entities/demande-salle.entity';

/** Demandes de salle : validation logistique, commentaires du N+1 et de l'assistante de direction. */
@Module({
  imports: [TypeOrmModule.forFeature([DemandeSalle]), DemandesModule, UtilisateursModule],
  controllers: [DemandesSalleController],
  providers: [DemandesSalleService],
})
export class SallesModule {}
