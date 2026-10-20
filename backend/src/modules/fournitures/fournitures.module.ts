import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticleStock } from '../ressources/entities/article-stock.entity';
import { DemandesModule } from '../demandes/demandes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UtilisateursModule } from '../utilisateurs/utilisateurs.module';
import { DemandesFournitureController } from './demandes-fourniture.controller';
import { DemandesFournitureService } from './demandes-fourniture.service';
import { BonDeSortie } from './entities/bon-de-sortie.entity';
import { DemandeFourniture } from './entities/demande-fourniture.entity';
import { LigneFourniture } from './entities/ligne-fourniture.entity';
import { MouvementStock } from './entities/mouvement-stock.entity';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

/**
 * Fournitures : catalogue du magasin et mouvements de stock (réception, inventaire) ;
 * demandes de fournitures (validation N+1 puis logistique, remise et bon de sortie par le magasinier).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ArticleStock, MouvementStock, DemandeFourniture, LigneFourniture, BonDeSortie]),
    DemandesModule,
    UtilisateursModule,
    NotificationsModule,
  ],
  controllers: [StockController, DemandesFournitureController],
  providers: [StockService, DemandesFournitureService],
  exports: [StockService],
})
export class FournituresModule {}
