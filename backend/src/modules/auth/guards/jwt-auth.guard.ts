import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Protège une route : un jeton JWT valide est exigé. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
