import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLE_ROLES } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

/** Vérifie les rôles exigés par @Roles(...) à partir du jeton (req.user, posé par JwtAuthGuard). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const exiges = this.reflector.getAllAndOverride<Role[]>(CLE_ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!exiges?.length) return true;
    const roles: string[] = ctx.switchToHttp().getRequest().user?.roles ?? [];
    if (exiges.some((r) => roles.includes(r))) return true;
    throw new ForbiddenException("Vous n'avez pas les droits pour cette action.");
  }
}
