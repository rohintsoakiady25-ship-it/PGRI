import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DemandesService } from './demandes.service';
import { Commentaire } from './entities/commentaire.entity';
import { Demande } from './entities/demande.entity';
import { HistoriqueStatut } from './entities/historique-statut.entity';
import { Validation } from './entities/validation.entity';

/** Socle commun du workflow : demande, validations (N1 / LOGISTIQUE), commentaires, historique. */
@Module({
  imports: [TypeOrmModule.forFeature([Demande, Validation, Commentaire, HistoriqueStatut])],
  providers: [DemandesService],
  exports: [DemandesService, TypeOrmModule],
})
export class DemandesModule {}
