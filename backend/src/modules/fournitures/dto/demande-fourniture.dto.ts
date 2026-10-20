import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { StatutDemande } from '../../../common/enums/statut-demande.enum';
import { DecisionValidation } from '../../../common/enums/validation.enum';

const texteOuNull = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** Un article demandé. */
export class LigneDemandeDto {
  @IsUUID('4', { message: 'Choisissez l’article de chaque ligne dans le catalogue.' })
  articleId!: string;

  @Type(() => Number)
  @Max(10000, { message: 'Quantité trop grande.' })
  @Min(1, { message: 'La quantité demandée doit être au moins 1.' })
  @IsInt({ message: 'La quantité doit être un nombre entier.' })
  quantite!: number;

  @IsOptional()
  @Transform(texteOuNull)
  @IsString()
  @MaxLength(255)
  observations?: string | null;
}

/** Soumission d'une demande de fournitures (section 4.1.4). */
export class DemandeFournitureDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Ajoutez au moins un article.' })
  @ArrayMaxSize(50, { message: 'Une demande compte au plus 50 articles.' })
  @ValidateNested({ each: true })
  @Type(() => LigneDemandeDto)
  lignes!: LigneDemandeDto[];

  /** « AAAA-MM-JJ », facultatif. */
  @IsOptional()
  @Transform(texteOuNull)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date du besoin invalide.' })
  dateBesoin?: string | null;

  @IsOptional()
  @Transform(texteOuNull)
  @IsString()
  @MaxLength(2000)
  observations?: string | null;
}

/** Décision du N+1 ou de la logistique ; le motif est obligatoire en cas de refus (contrôlé par le service). */
export class DecisionFournitureDto {
  @IsIn(Object.values(DecisionValidation), { message: 'Décision inconnue.' })
  decision!: DecisionValidation;

  @IsOptional()
  @Transform(texteOuNull)
  @IsString()
  @MaxLength(1000)
  commentaire?: string | null;
}

/** Filtre de la liste des demandes à suivre. */
export class FiltreDemandesFournitureDto {
  @IsOptional()
  @IsEnum(StatutDemande)
  statut?: StatutDemande;
}

/** Quantité réellement remise pour une ligne ; motif obligatoire si elle est inférieure à la quantité demandée. */
export class LigneRemiseDto {
  @IsUUID('4', { message: 'Ligne inconnue.' })
  ligneId!: string;

  @Type(() => Number)
  @Max(10000, { message: 'Quantité trop grande.' })
  @Min(0, { message: 'La quantité remise ne peut pas être négative.' })
  @IsInt({ message: 'La quantité remise doit être un nombre entier.' })
  quantiteLivree!: number;

  @IsOptional()
  @Transform(texteOuNull)
  @IsString()
  @MaxLength(255)
  observations?: string | null;
}

/** Remise des fournitures par le magasinier : une entrée par ligne de la demande. */
export class RemiseDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LigneRemiseDto)
  lignes!: LigneRemiseDto[];
}
