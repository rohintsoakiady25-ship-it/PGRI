import { Module } from '@nestjs/common';
import { TableauDeBordController } from './tableau-de-bord.controller';
import { TableauDeBordService } from './tableau-de-bord.service';

/** Tableau de bord transversal et rapport mensuel (imprimable). */
@Module({
  controllers: [TableauDeBordController],
  providers: [TableauDeBordService],
})
export class AnalytiqueModule {}
