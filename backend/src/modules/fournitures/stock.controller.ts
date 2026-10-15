import {
  Body, Controller, DefaultValuePipe, Delete, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { JetonPayload } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ArticleStockDto, EntreeStockDto } from './dto/article-stock.dto';
import { StockService } from './stock.service';

type RequeteAuth = Request & { user: JetonPayload };

/**
 * Fournitures du magasin : le catalogue est lisible par tous (formulaire de demande) ;
 * réception, liste avec stock, modification et suppression sont réservées à la logistique et à l'administrateur.
 */
@Controller('articles-stock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('catalogue')
  catalogue() {
    return this.stock.catalogue();
  }

  @Get()
  @Roles(Role.LOGISTIQUE, Role.ADMIN)
  lister() {
    return this.stock.lister();
  }

  @Get('entrees')
  @Roles(Role.LOGISTIQUE, Role.ADMIN)
  entrees(@Query('limite', new DefaultValuePipe(15), ParseIntPipe) limite: number) {
    return this.stock.dernieresEntrees(Math.min(Math.max(limite, 1), 100));
  }

  @Post('entrees')
  @Roles(Role.LOGISTIQUE, Role.ADMIN)
  entrer(@Req() req: RequeteAuth, @Body() dto: EntreeStockDto) {
    return this.stock.entrer(req.user.sub, dto);
  }

  @Put(':id')
  @Roles(Role.LOGISTIQUE, Role.ADMIN)
  modifier(@Req() req: RequeteAuth, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ArticleStockDto) {
    return this.stock.modifier(req.user.sub, id, dto);
  }

  @Delete(':id')
  @Roles(Role.LOGISTIQUE, Role.ADMIN)
  @HttpCode(204)
  supprimer(@Param('id', ParseUUIDPipe) id: string) {
    return this.stock.supprimer(id);
  }
}
