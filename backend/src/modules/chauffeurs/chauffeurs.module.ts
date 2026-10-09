import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chauffeur } from './entities/chauffeur.entity';
import { ChauffeursController } from './chauffeurs.controller';
import { ChauffeursService } from './chauffeurs.service';

/** Chauffeurs affectables aux missions. */
@Module({
  imports: [TypeOrmModule.forFeature([Chauffeur])],
  controllers: [ChauffeursController],
  providers: [ChauffeursService],
  exports: [ChauffeursService],
})
export class ChauffeursModule {}
