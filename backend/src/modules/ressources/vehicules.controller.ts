import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FiltreVehiculesDto, VehiculeDto } from './dto/vehicule.dto';
import { VehiculesService } from './vehicules.service';

/** Liste des voitures : consultation par tout utilisateur connecté ; ajout et modification par la logistique et l'administrateur. */
@Controller('vehicules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiculesController {
  constructor(private readonly vehicules: VehiculesService) {}

  @Get()
  lister(@Query() filtres: FiltreVehiculesDto) {
    return this.vehicules.lister(filtres);
  }

  @Post()
  @Roles(Role.LOGISTIQUE, Role.ADMIN)
  creer(@Body() dto: VehiculeDto) {
    return this.vehicules.creer(dto);
  }

  @Put(':id')
  @Roles(Role.LOGISTIQUE, Role.ADMIN)
  modifier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VehiculeDto) {
    return this.vehicules.modifier(id, dto);
  }
}
