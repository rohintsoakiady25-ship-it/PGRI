import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const CLE_ROLES = 'roles';

/** Réserve une route aux utilisateurs ayant au moins un de ces rôles (avec JwtAuthGuard puis RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(CLE_ROLES, roles);
