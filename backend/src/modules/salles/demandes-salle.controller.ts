import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { JetonPayload } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Acteur } from '../demandes/demandes.service';
import { UtilisateursService } from '../utilisateurs/utilisateurs.service';
import {
  CommentaireDto, DecisionSalleDto, DemandeSalleDto, DisponibiliteDto, FiltreDemandesSalleDto, PeriodeDto,
} from './dto/demande-salle.dto';
import { DemandesSalleService } from './demandes-salle.service';

type RequeteAuth = Request & { user: JetonPayload };

/**
 * Réservations de salle (circuit 4.1.1) : tout utilisateur réserve ; le responsable logistique valide ;
 * le N+1 et l'assistante de direction consultent et commentent. Les droits fins sont vérifiés par le service.
 */
@Controller('demandes-salle')
@UseGuards(JwtAuthGuard)
export class DemandesSalleController {
  constructor(
    private readonly service: DemandesSalleService,
    private readonly utilisateurs: UtilisateursService,
  ) {}

  /** Rôles et direction lus en base : un changement est pris en compte sans attendre un nouveau jeton. */
  private async acteur(req: RequeteAuth): Promise<Acteur> {
    const u = await this.utilisateurs.trouverParId(req.user.sub);
    if (!u || !u.actif) throw new UnauthorizedException('Session expirée. Reconnectez-vous.');
    return u;
  }

  @Get('planning')
  async planning(@Req() req: RequeteAuth, @Query() p: PeriodeDto) {
    return this.service.planning(await this.acteur(req), p.du, p.au);
  }

  @Get('disponibilite')
  disponibilite(@Query() dto: DisponibiliteDto) {
    return this.service.disponibilite(dto);
  }

  @Get('mes')
  async mes(@Req() req: RequeteAuth) {
    return this.service.mesDemandes(await this.acteur(req));
  }

  @Get()
  async aSuivre(@Req() req: RequeteAuth, @Query() filtre: FiltreDemandesSalleDto) {
    return this.service.demandesASuivre(await this.acteur(req), filtre);
  }

  @Get(':id')
  async detail(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(await this.acteur(req), id);
  }

  @Post()
  async soumettre(@Req() req: RequeteAuth, @Body() dto: DemandeSalleDto) {
    return this.service.soumettre(await this.acteur(req), dto);
  }

  @Post(':id/decision')
  @HttpCode(200)
  async decider(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DecisionSalleDto) {
    return this.service.decider(await this.acteur(req), id, dto);
  }

  @Post(':id/annulation')
  @HttpCode(200)
  async annuler(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.annuler(await this.acteur(req), id);
  }

  @Post(':id/commentaires')
  async commenter(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CommentaireDto) {
    return this.service.commenter(await this.acteur(req), id, dto);
  }
}
