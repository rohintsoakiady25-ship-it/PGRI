import { Transform, Type } from 'class-transformer';
import {
  IsDate, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf,
} from 'class-validator';
import { StatutDemande } from '../../../common/enums/statut-demande.enum';
import { DecisionValidation } from '../../../common/enums/validation.enum';
import { TypeDeplacement } from '../../../common/enums/type-demande.enum';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const texteOuNull = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() ? value.trim() : null);

// Emprise de Madagascar (avec une marge), pour refuser des coordonnées manifestement fausses
const LAT = { min: -26, max: -11 };
const LON = { min: 42, max: 51.5 };

/** Soumission d'une demande de déplacement (section 4.1.2). */
export class DemandeDeplacementDto {
  @IsEnum(TypeDeplacement, { message: 'Choisissez le type de déplacement (ville ou mission).' })
  typeDeplacement!: TypeDeplacement;

  @Transform(nettoyer)
  @IsString()
  @MinLength(5, { message: 'Précisez le motif du déplacement (5 caractères au moins).' })
  @MaxLength(500)
  motif!: string;

  @Transform(nettoyer)
  @IsString()
  @IsNotEmpty({ message: 'Choisissez le lieu de départ.' })
  @MaxLength(200)
  lieuDepart!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Lieu de départ sans coordonnées : choisissez-le dans la liste ou sur la carte.' })
  @Min(LAT.min, { message: 'Le lieu de départ doit être à Madagascar.' })
  @Max(LAT.max, { message: 'Le lieu de départ doit être à Madagascar.' })
  departLatitude!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Lieu de départ sans coordonnées : choisissez-le dans la liste ou sur la carte.' })
  @Min(LON.min, { message: 'Le lieu de départ doit être à Madagascar.' })
  @Max(LON.max, { message: 'Le lieu de départ doit être à Madagascar.' })
  departLongitude!: number;

  @Transform(nettoyer)
  @IsString()
  @IsNotEmpty({ message: 'Choisissez la destination.' })
  @MaxLength(200)
  destination!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Destination sans coordonnées : choisissez-la dans la liste ou sur la carte.' })
  @Min(LAT.min, { message: 'La destination doit être à Madagascar.' })
  @Max(LAT.max, { message: 'La destination doit être à Madagascar.' })
  destinationLatitude!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Destination sans coordonnées : choisissez-la dans la liste ou sur la carte.' })
  @Min(LON.min, { message: 'La destination doit être à Madagascar.' })
  @Max(LON.max, { message: 'La destination doit être à Madagascar.' })
  destinationLongitude!: number;

  @IsOptional()
  @Transform(texteOuNull)
  @IsString()
  @MaxLength(200_000)
  itineraireRetenu?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5000)
  distanceEstimeeKm?: number | null;

  @Type(() => Date)
  @IsDate({ message: 'Date et heure de départ invalides.' })
  dateHeureDepart!: Date;

  @Type(() => Date)
  @IsDate({ message: 'Date et heure de retour invalides.' })
  dateHeureRetourPrevue!: Date;

  /** Obligatoire pour une mission. */
  @ValidateIf((d: DemandeDeplacementDto) => d.typeDeplacement === TypeDeplacement.MISSION)
  @Type(() => Number)
  @Max(90, { message: 'Une mission dure au plus 90 jours.' })
  @Min(1, { message: 'La mission dure au moins 1 jour.' })
  @IsInt({ message: 'Indiquez la durée de la mission en jours.' }) // vérifié en premier (décorateurs lus de bas en haut)
  dureeMissionJours?: number | null;

  @IsOptional()
  @Transform(texteOuNull)
  @IsString()
  @MaxLength(2000)
  personnesConcernees?: string | null;
}

/** Décision du supérieur direct ; le motif est obligatoire en cas de refus (contrôlé par le service). */
export class DecisionN1Dto {
  @IsIn(Object.values(DecisionValidation), { message: 'Décision inconnue.' })
  decision!: DecisionValidation;

  @IsOptional()
  @Transform(texteOuNull)
  @IsString()
  @MaxLength(1000)
  commentaire?: string | null;
}

/** Filtre de la liste des demandes à suivre. */
export class FiltreDemandesDeplacementDto {
  @IsOptional()
  @IsEnum(StatutDemande)
  statut?: StatutDemande;
}

/**
 * Décision du responsable logistique. Validée : un véhicule et un chauffeur, ou une affectation
 * existante à partager (regroupement). Le motif est obligatoire en cas de refus (contrôlé par le service).
 */
export class DecisionLogistiqueDto extends DecisionN1Dto {
  @IsOptional()
  @IsUUID('4', { message: 'Véhicule inconnu.' })
  vehiculeId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Chauffeur inconnu.' })
  chauffeurId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Affectation inconnue.' })
  affectationId?: string;
}

/** Retour de mission : heure réelle (par défaut maintenant) et incidents éventuels. */
export class RetourMissionDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Heure de retour invalide.' })
  heureRetourReelle?: Date;

  @IsOptional()
  @Transform(texteOuNull)
  @IsString()
  @MaxLength(2000)
  incidents?: string | null;
}
