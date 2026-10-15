import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
  ValidateIf, ValidateNested,
} from 'class-validator';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const videEnNull = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? null : nettoyer({ value }));

/** Une ligne de réception : un article du catalogue, ou un nouvel article (désignation + unité). */
export class LigneEntreeDto {
  @IsOptional()
  @IsUUID('4', { message: 'Article inconnu.' })
  articleId?: string;

  @ValidateIf((l: LigneEntreeDto) => !l.articleId)
  @Transform(nettoyer)
  @IsString()
  @IsNotEmpty({ message: 'Indiquez la désignation de chaque nouvel article.' })
  @MaxLength(150)
  designation?: string;

  @ValidateIf((l: LigneEntreeDto) => !l.articleId)
  @Transform(nettoyer)
  @IsString()
  @IsNotEmpty({ message: 'Indiquez l’unité de chaque nouvel article (pièce, paquet…).' })
  @MaxLength(30)
  unite?: string;

  @IsOptional()
  @Transform(videEnNull)
  @IsString()
  @MaxLength(60)
  categorie?: string | null;

  @Type(() => Number)
  @IsInt({ message: 'La quantité doit être un nombre entier.' })
  @Min(1, { message: 'La quantité reçue doit être au moins 1.' })
  @Max(100000)
  quantite!: number;
}

/** Réception de fournitures au magasin (plusieurs articles à la fois). */
export class EntreeStockDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Ajoutez au moins un article.' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LigneEntreeDto)
  lignes!: LigneEntreeDto[];

  @IsOptional()
  @Transform(videEnNull)
  @IsString()
  @MaxLength(150)
  fournisseur?: string | null;

  @IsOptional()
  @Transform(videEnNull)
  @IsString()
  @MaxLength(255)
  observation?: string | null;
}

/** Modification d'une fiche article ; stockCompte corrige le stock après inventaire. */
export class ArticleStockDto {
  @Transform(nettoyer)
  @IsString()
  @IsNotEmpty({ message: 'La désignation est obligatoire.' })
  @MaxLength(150)
  designation!: string;

  @Transform(nettoyer)
  @IsString()
  @IsNotEmpty({ message: 'L’unité est obligatoire.' })
  @MaxLength(30)
  unite!: string;

  @IsOptional()
  @Transform(videEnNull)
  @IsString()
  @MaxLength(60)
  categorie?: string | null;

  @Type(() => Number)
  @IsInt({ message: 'Le seuil d’alerte doit être un nombre entier.' })
  @Min(0)
  @Max(100000)
  seuilAlerte!: number;

  @IsOptional()
  @Transform(videEnNull)
  @IsString()
  @MaxLength(150)
  fournisseur?: string | null;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Le stock compté doit être un nombre entier.' })
  @Min(0, { message: 'Le stock compté ne peut pas être négatif.' })
  @Max(1000000)
  stockCompte?: number;
}
