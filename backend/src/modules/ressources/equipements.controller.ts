import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EquipementDto } from './dto/equipement.dto';
import { EquipementsService } from './equipements.service';

/** Équipements des salles : consultation et gestion réservées à la logistique et à l'administrateur. */
@Controller('equipements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.LOGISTIQUE, Role.ADMIN)
export class EquipementsController {
  constructor(private readonly equipements: EquipementsService) {}

  @Get()
  lister() {
    return this.equipements.lister();
  }

  @Post()
  creer(@Body() dto: EquipementDto) {
    return this.equipements.creer(dto);
  }

  @Put(':id')
  modifier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EquipementDto) {
    return this.equipements.modifier(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  supprimer(@Param('id', ParseUUIDPipe) id: string) {
    return this.equipements.supprimer(id);
  }
}
