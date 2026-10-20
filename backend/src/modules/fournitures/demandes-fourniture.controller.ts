import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { JetonPayload } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Acteur } from '../demandes/demandes.service';
import { UtilisateursService } from '../utilisateurs/utilisateurs.service';
import { DecisionFournitureDto, DemandeFournitureDto, FiltreDemandesFournitureDto, RemiseDto } from './dto/demande-fourniture.dto';
import { DemandesFournitureService } from './demandes-fourniture.service';

type RequeteAuth = Request & { user: JetonPayload };

/**
 * Demandes de fournitures : tout utilisateur soumet, suit et annule les siennes ; le N+1 puis la logistique
 * les valident. Les droits fins sont vérifiés par le service.
 */
@Controller('demandes-fourniture')
@UseGuards(JwtAuthGuard)
export class DemandesFournitureController {
  constructor(
    private readonly service: DemandesFournitureService,
    private readonly utilisateurs: UtilisateursService,
  ) {}

  /** Rôles et direction lus en base : un changement est pris en compte sans attendre un nouveau jeton. */
  private async acteur(req: RequeteAuth): Promise<Acteur> {
    const u = await this.utilisateurs.trouverParId(req.user.sub);
    if (!u || !u.actif) throw new UnauthorizedException('Session expirée. Reconnectez-vous.');
    return u;
  }

  @Get('mes')
  async mes(@Req() req: RequeteAuth) {
    return this.service.mesDemandes(await this.acteur(req));
  }

  /** Demandes des collaborateurs (N+1), de la direction (assistante), validées (magasinier), ou toutes (logistique). */
  @Get()
  async aSuivre(@Req() req: RequeteAuth, @Query() filtre: FiltreDemandesFournitureDto) {
    return this.service.demandesASuivre(await this.acteur(req), filtre);
  }

  @Get(':id')
  async detail(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(await this.acteur(req), id);
  }

  /** Bon de sortie d'une demande remise (affichage imprimable). */
  @Get(':id/bon-de-sortie')
  async bon(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.bonDeSortie(await this.acteur(req), id);
  }

  @Post()
  async soumettre(@Req() req: RequeteAuth, @Body() dto: DemandeFournitureDto) {
    return this.service.soumettre(await this.acteur(req), dto);
  }

  @Post(':id/decision-n1')
  @HttpCode(200)
  async deciderN1(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionFournitureDto) {
    return this.service.deciderN1(await this.acteur(req), id, dto);
  }

  @Post(':id/decision-logistique')
  @HttpCode(200)
  async deciderLogistique(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionFournitureDto) {
    return this.service.deciderLogistique(await this.acteur(req), id, dto);
  }

  /** Le magasinier prend la demande en charge (« En préparation »). */
  @Post(':id/preparation')
  @HttpCode(200)
  async preparation(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.prendreEnCharge(await this.acteur(req), id);
  }

  /** Remise des fournitures : quantités livrées, sortie de stock et bon de sortie. */
  @Post(':id/remise')
  @HttpCode(200)
  async remise(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RemiseDto) {
    return this.service.remettre(await this.acteur(req), id, dto);
  }

  @Post(':id/annulation')
  @HttpCode(200)
  async annuler(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.annuler(await this.acteur(req), id);
  }
}
