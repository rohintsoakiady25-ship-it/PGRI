import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, JetonPayload } from './auth.service';
import { ConnexionDto } from './dto/connexion.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Méthodes de connexion disponibles sur ce serveur (AD configuré ou non). */
  @Get('methodes')
  methodes() {
    return this.auth.methodesDisponibles();
  }

  /** Connexion par Active Directory (methode = "ad") ou par compte local (methode = "local"). */
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: ConnexionDto) {
    return this.auth.connecter(dto);
  }

  /** Profil de l'utilisateur connecté. */
  @Get('moi')
  @UseGuards(JwtAuthGuard)
  moi(@Req() req: Request & { user: JetonPayload }) {
    return this.auth.profilCourant(req.user.sub);
  }
}
