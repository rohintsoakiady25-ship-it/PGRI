import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

/** Ajout ou modification d'une salle (la modification remplace toutes les valeurs). Les équipements se gèrent à part. */
export class SalleDto {
  @Transform(nettoyer)
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la salle est obligatoire.' })
  @MaxLength(150)
  nom!: string;

  @Type(() => Number)
  @IsInt({ message: 'La capacité doit être un nombre entier.' })
  @Min(1, { message: 'La capacité doit être d’au moins 1 place.' })
  @Max(500)
  capacite!: number;

  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : nettoyer({ value })))
  @IsOptional()
  @IsString()
  @MaxLength(150)
  localisation?: string | null;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
