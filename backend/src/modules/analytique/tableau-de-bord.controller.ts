import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MoisDto } from './dto/mois.dto';
import { TableauDeBordService } from './tableau-de-bord.service';

/** Tableau de bord transversal : réservé à la logistique et à l'administrateur. */
@Controller('tableau-de-bord')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.LOGISTIQUE, Role.ADMIN)
export class TableauDeBordController {
  constructor(private readonly service: TableauDeBordService) {}

  /** Indicateurs d'un mois (« AAAA-MM », par défaut le mois en cours). */
  @Get()
  indicateurs(@Query() q: MoisDto) {
    return this.service.indicateurs(q.mois);
  }
}
