import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReferentielMnpService } from './referentiel-mnp.service';

/**
 * Référentiel géographique de MNP pour les formulaires (tout utilisateur connecté).
 * Les appels à mnp-ugs-api se font ici, côté serveur : le secret de PGRI ne quitte jamais le backend.
 */
@Controller('cartographie')
@UseGuards(JwtAuthGuard)
export class CartographieController {
  constructor(private readonly referentiel: ReferentielMnpService) {}

  /** Aires protégées (avec un point d'arrivée) et unités de gestion. */
  @Get('referentiel')
  lire() {
    return this.referentiel.referentiel();
  }

  /** Contour GeoJSON d'une aire protégée. */
  @Get('aires-protegees/:id/contour')
  contour(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.referentiel.contour(id);
  }
}
