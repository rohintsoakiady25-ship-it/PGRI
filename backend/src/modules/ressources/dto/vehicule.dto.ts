import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { EtatTechnique } from '../../../common/enums/etat-technique.enum';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const videEnNull = ({ value }: { value: unknown }) => (value === '' || value === undefined ? null : nettoyer({ value }));
/** Date seule « AAAA-MM-JJ », facultative. */
const DATE = { strict: true } as const;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Ajout ou modification d'un véhicule (la modification remplace toutes les valeurs). */
export class VehiculeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toUpperCase() : value))
  @IsString()
  @Matches(/^[0-9A-Z][0-9A-Z -]{2,18}[0-9A-Z]$/, { message: "Immatriculation invalide (chiffres, lettres, espaces ; ex. « 1234 TBA »)." })
  immatriculation!: string;

  @Transform(videEnNull)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  marqueModele?: string | null;

  @Transform(({ value }) => (value === '' || value === null || value === undefined ? null : Number(value)))
  @IsOptional()
  @IsInt({ message: 'Le nombre de places doit être un nombre entier.' })
  @Min(1)
  @Max(60)
  nbPlaces?: number | null;

  @IsEnum(EtatTechnique, { message: 'État technique inconnu.' })
  etatTechnique!: EtatTechnique;

  @Transform(videEnNull)
  @IsOptional()
  @Matches(JOUR, { message: "Date de début d'assurance invalide." })
  @IsDateString(DATE, { message: "Date de début d'assurance invalide." })
  assuranceDebut?: string | null;

  @Transform(videEnNull)
  @IsOptional()
  @Matches(JOUR, { message: "Date de fin d'assurance invalide." })
  @IsDateString(DATE, { message: "Date de fin d'assurance invalide." })
  assuranceFin?: string | null;

  @Transform(videEnNull)
  @IsOptional()
  @Matches(JOUR, { message: 'Date de début de visite technique invalide.' })
  @IsDateString(DATE, { message: 'Date de début de visite technique invalide.' })
  visiteTechniqueDebut?: string | null;

  @Transform(videEnNull)
  @IsOptional()
  @Matches(JOUR, { message: 'Date de fin de visite technique invalide.' })
  @IsDateString(DATE, { message: 'Date de fin de visite technique invalide.' })
  visiteTechniqueFin?: string | null;

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
