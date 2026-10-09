import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

/** Ajout ou modification d'un chauffeur (la modification remplace toutes les valeurs). */
export class ChauffeurDto {
  @Transform(nettoyer)
  @IsString()
  @IsNotEmpty({ message: 'Le nom est obligatoire.' })
  @MaxLength(150)
  nomComplet!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^[0-9]{3,20}$/, { message: 'Matricule invalide (chiffres uniquement, ex. « 10421 »).' })
  matricule!: string;

  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : nettoyer({ value })))
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ]{7,20}$/, { message: 'Numéro de téléphone invalide (chiffres et espaces, ex. « 034 12 345 67 »).' })
  telephone?: string | null;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() || null : value))
  @IsOptional()
  @IsString()
  @MaxLength(30)
  numeroPermis?: string | null;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

export class FiltreChauffeursDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
