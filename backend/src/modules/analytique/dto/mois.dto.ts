import { IsOptional, Matches } from 'class-validator';

/** Mois du tableau de bord. */
export class MoisDto {
  @IsOptional()
  @Matches(/^20\d{2}-(0[1-9]|1[0-2])$/, { message: 'Mois invalide (AAAA-MM).' })
  mois?: string;
}
