import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

/** Liste d'équipements : libellés nettoyés, sans doublon ni valeur vide. */
const nettoyerListe = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? [...new Set(value.map((e) => (typeof e === 'string' ? e.trim().replace(/\s+/g, ' ') : e)).filter((e) => e !== ''))]
    : value;

/** Ajout ou modification d'une salle (la modification remplace toutes les valeurs). */
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

  @Transform(nettoyerListe)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  equipements!: string[];

  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : nettoyer({ value })))
  @IsOptional()
  @IsString()
  @MaxLength(150)
  localisation?: string | null;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
