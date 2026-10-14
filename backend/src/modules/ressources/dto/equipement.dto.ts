import { Transform } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);

/** Ajout ou modification d'un équipement (la modification remplace toutes les valeurs). */
export class EquipementDto {
  /** Référence de l'appareil, en majuscules (ex. VP-01). */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, '-').toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._/-]{0,29}$/, { message: 'Référence invalide (lettres, chiffres et tirets, ex. « VP-01 »).' })
  reference!: string;

  @Transform(nettoyer)
  @IsString()
  @IsNotEmpty({ message: 'Le nom de l’équipement est obligatoire.' })
  @MaxLength(100)
  nom!: string;

  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : nettoyer({ value })))
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string | null;

  /** false : une seule salle ; true : plusieurs salles possibles. */
  @IsBoolean({ message: 'Indiquez si l’équipement va dans une seule salle ou dans plusieurs.' })
  plusieursSalles!: boolean;

  @Transform(({ value }) => (Array.isArray(value) ? [...new Set(value)] : value))
  @IsArray()
  @ArrayMinSize(1, { message: 'Choisissez au moins une salle.' })
  @IsUUID('4', { each: true, message: 'Salle inconnue.' })
  salleIds!: string[];

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
