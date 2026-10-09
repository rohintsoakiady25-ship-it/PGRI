import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FiltreVehiculesDto, VehiculeDto } from './dto/vehicule.dto';
import { VehiculesService } from './vehicules.service';

/** Liste des voitures : consultation, ajout, modification et suppression réservés à la logistique et à l'administrateur. */
@Controller('vehicules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.LOGISTIQUE, Role.ADMIN)
export class VehiculesController {
  constructor(private readonly vehicules: VehiculesService) {}

  @Get()
  lister(@Query() filtres: FiltreVehiculesDto) {
    return this.vehicules.lister(filtres);
  }

  @Post()
  creer(@Body() dto: VehiculeDto) {
    return this.vehicules.creer(dto);
  }

  @Put(':id')
  modifier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VehiculeDto) {
    return this.vehicules.modifier(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  supprimer(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicules.supprimer(id);
  }
}
