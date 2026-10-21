import { Module } from '@nestjs/common';
import { CartographieController } from './cartographie.controller';
import { ReferentielMnpService } from './referentiel-mnp.service';
import { UgsClientService } from './ugs-client.service';

/** Référentiel géographique de MNP (aires protégées, unités de gestion) via l'API mnp-ugs-api de la DSII. */
@Module({
  controllers: [CartographieController],
  providers: [UgsClientService, ReferentielMnpService],
  exports: [ReferentielMnpService],
})
export class CartographieModule {}
