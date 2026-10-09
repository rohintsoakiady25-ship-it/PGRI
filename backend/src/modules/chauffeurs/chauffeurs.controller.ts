import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChauffeurDto, FiltreChauffeursDto } from './dto/chauffeur.dto';
import { ChauffeursService } from './chauffeurs.service';

/** Liste des chauffeurs : consultation par tout utilisateur connecté ; ajout et modification par la logistique et l'administrateur. */
@Controller('chauffeurs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChauffeursController {
  constructor(private readonly chauffeurs: ChauffeursService) {}

  @Get()
  lister(@Query() filtres: FiltreChauffeursDto) {
    return this.chauffeurs.lister(filtres);
  }

  @Post()
  @Roles(Role.LOGISTIQUE, Role.ADMIN)
  creer(@Body() dto: ChauffeurDto) {
    return this.chauffeurs.creer(dto);
  }

  @Put(':id')
  @Roles(Role.LOGISTIQUE, Role.ADMIN)
  modifier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChauffeurDto) {
    return this.chauffeurs.modifier(id, dto);
  }
}
