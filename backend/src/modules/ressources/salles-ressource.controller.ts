import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SalleDto } from './dto/salle.dto';
import { SallesRessourceService } from './salles-ressource.service';

/**
 * Liste des salles : les salles en service sont visibles de tous (formulaire de réservation) ;
 * la liste complète et sa gestion sont réservées à la logistique et à l'administrateur.
 */
@Controller('salles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SallesRessourceController {
  constructor(private readonly salles: SallesRessourceService) {}

  /** Salles en service, pour réserver. */
  @Get('disponibles')
  listerActives() {
    return this.salles.lister(true);
  }

  @Get()
  @Roles(Role.LOGISTIQUE, Role.ADMIN)
  lister() {
    return this.salles.lister();
  }

  @Post()
  @Roles(Role.LOGISTIQUE, Role.ADMIN)
  creer(@Body() dto: SalleDto) {
    return this.salles.creer(dto);
  }

  @Put(':id')
  @Roles(Role.LOGISTIQUE, Role.ADMIN)
  modifier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SalleDto) {
    return this.salles.modifier(id, dto);
  }

  @Delete(':id')
  @Roles(Role.LOGISTIQUE, Role.ADMIN)
  @HttpCode(204)
  supprimer(@Param('id', ParseUUIDPipe) id: string) {
    return this.salles.supprimer(id);
  }
}
