import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticleStock } from '../ressources/entities/article-stock.entity';
import { MouvementStock } from './entities/mouvement-stock.entity';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

/**
 * Fournitures : catalogue du magasin et mouvements de stock (réception, inventaire) ;
 * demandes (validation N+1 puis logistique, remise et bon de sortie par le magasinier) à venir.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ArticleStock, MouvementStock])],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class FournituresModule {}
