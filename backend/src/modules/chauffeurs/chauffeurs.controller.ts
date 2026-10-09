import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChauffeurDto, FiltreChauffeursDto } from './dto/chauffeur.dto';
import { ChauffeursService } from './chauffeurs.service';

/** Liste des chauffeurs : consultation, ajout, modification et suppression réservés à la logistique et à l'administrateur. */
@Controller('chauffeurs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.LOGISTIQUE, Role.ADMIN)
export class ChauffeursController {
  constructor(private readonly chauffeurs: ChauffeursService) {}

  @Get()
  lister(@Query() filtres: FiltreChauffeursDto) {
    return this.chauffeurs.lister(filtres);
  }

  @Post()
  creer(@Body() dto: ChauffeurDto) {
    return this.chauffeurs.creer(dto);
  }

  @Put(':id')
  modifier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChauffeurDto) {
    return this.chauffeurs.modifier(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  supprimer(@Param('id', ParseUUIDPipe) id: string) {
    return this.chauffeurs.supprimer(id);
  }
}
