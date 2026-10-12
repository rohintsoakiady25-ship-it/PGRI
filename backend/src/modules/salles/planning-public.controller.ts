import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PeriodeDto } from './dto/demande-salle.dto';
import { PlanningPublicService } from './planning-public.service';

/** Gestion du lien public (logistique, administrateur). */
@Controller('planning-salles/lien-public')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.LOGISTIQUE, Role.ADMIN)
export class LienPublicController {
  constructor(private readonly service: PlanningPublicService) {}

  @Get()
  lien() {
    return this.service.lien();
  }

  @Post('regeneration')
  regenerer() {
    return this.service.regenerer();
  }
}

/** Planning des salles en lecture seule, sans connexion : accès par le lien (ou le QR code). */
@Controller('public/planning-salles')
export class PlanningPublicController {
  constructor(private readonly service: PlanningPublicService) {}

  @Get(':jeton')
  planning(@Param('jeton') jeton: string, @Query() p: PeriodeDto) {
    return this.service.planning(jeton, p.du, p.au);
  }
}
