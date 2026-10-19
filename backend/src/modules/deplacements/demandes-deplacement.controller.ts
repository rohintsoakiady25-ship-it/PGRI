import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { JetonPayload } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Acteur } from '../demandes/demandes.service';
import { UtilisateursService } from '../utilisateurs/utilisateurs.service';
import {
  DecisionLogistiqueDto, DecisionN1Dto, DemandeDeplacementDto, FiltreDemandesDeplacementDto, RetourMissionDto,
} from './dto/demande-deplacement.dto';
import { DemandesDeplacementService } from './demandes-deplacement.service';

type RequeteAuth = Request & { user: JetonPayload };

/**
 * Demandes de déplacement : tout utilisateur soumet, suit et annule les siennes ; le N+1 valide celles
 * de ses collaborateurs ; la logistique valide et affecte un véhicule et un chauffeur.
 * Les droits fins sont vérifiés par le service.
 */
@Controller('demandes-deplacement')
@UseGuards(JwtAuthGuard)
export class DemandesDeplacementController {
  constructor(
    private readonly service: DemandesDeplacementService,
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

  /** Demandes des collaborateurs (N+1), de la direction (assistante), ou toutes (logistique). */
  @Get()
  async aSuivre(@Req() req: RequeteAuth, @Query() filtre: FiltreDemandesDeplacementDto) {
    return this.service.demandesASuivre(await this.acteur(req), filtre);
  }

  @Get(':id')
  async detail(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(await this.acteur(req), id);
  }

  /** Véhicules, chauffeurs et regroupements possibles pour la demande (logistique). */
  @Get(':id/affectation-options')
  async options(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.optionsAffectation(await this.acteur(req), id);
  }

  @Post()
  async soumettre(@Req() req: RequeteAuth, @Body() dto: DemandeDeplacementDto) {
    return this.service.soumettre(await this.acteur(req), dto);
  }

  @Post(':id/decision-n1')
  @HttpCode(200)
  async deciderN1(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionN1Dto) {
    return this.service.deciderN1(await this.acteur(req), id, dto);
  }

  @Post(':id/decision-logistique')
  @HttpCode(200)
  async deciderLogistique(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionLogistiqueDto) {
    return this.service.deciderLogistique(await this.acteur(req), id, dto);
  }

  /** Départ de la mission (logistique) : la mission et les demandes regroupées passent « En cours ». */
  @Post(':id/depart')
  @HttpCode(200)
  async depart(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.depart(await this.acteur(req), id);
  }

  /** Retour de la mission (logistique) : heure réelle et incidents ; la mission passe « Terminée ». */
  @Post(':id/retour')
  @HttpCode(200)
  async retour(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RetourMissionDto) {
    return this.service.retour(await this.acteur(req), id, dto);
  }

  @Post(':id/annulation')
  @HttpCode(200)
  async annuler(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.annuler(await this.acteur(req), id);
  }
}
