import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { EtatTechnique } from '../../../common/enums/etat-technique.enum';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

/** Ajout ou modification d'un véhicule (la modification remplace toutes les valeurs). */
export class VehiculeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toUpperCase() : value))
  @IsString()
  @Matches(/^[0-9A-Z][0-9A-Z -]{2,18}[0-9A-Z]$/, { message: "Immatriculation invalide (chiffres, lettres, espaces ; ex. « 1234 TBA »)." })
  immatriculation!: string;

  @Transform(nettoyer)
  @IsString()
  @IsNotEmpty({ message: 'La marque et le modèle sont obligatoires.' })
  @MaxLength(100)
  marqueModele!: string;

  @Type(() => Number)
  @IsInt({ message: 'Le nombre de places doit être un nombre entier.' })
  @Min(1)
  @Max(60)
  nbPlaces!: number;

  @Type(() => Number)
  @IsInt({ message: 'Le kilométrage doit être un nombre entier.' })
  @Min(0, { message: 'Le kilométrage ne peut pas être négatif.' })
  kilometrage!: number;

  @IsEnum(EtatTechnique, { message: 'État technique inconnu.' })
  etatTechnique!: EtatTechnique;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}

/** Filtres de la liste (paramètres de l'URL). */
export class FiltreVehiculesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(EtatTechnique)
  etat?: EtatTechnique;
}
