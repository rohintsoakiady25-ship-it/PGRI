import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDate, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { DecisionValidation } from '../../../common/enums/validation.enum';
import { StatutDemande } from '../../../common/enums/statut-demande.enum';

const nettoyer = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
const nettoyerListe = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? [...new Set(value.map((e) => (typeof e === 'string' ? e.trim() : e)).filter((e) => e !== ''))]
    : value;
/** Texte libre facultatif : vide → null. */
const texteFacultatif = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

/** Créneau demandé (dates ISO 8601 avec fuseau, ex. 2026-10-14T09:00:00+03:00). */
class Creneau {
  @Type(() => Date)
  @IsDate({ message: 'Date et heure de début invalides.' })
  debut!: Date;

  @Type(() => Date)
  @IsDate({ message: 'Date et heure de fin invalides.' })
  fin!: Date;
}

/** Soumission d'une réservation de salle (section 4.1.3). */
export class DemandeSalleDto extends Creneau {
  @IsUUID('4', { message: 'Choisissez une salle.' })
  salleId!: string;

  @Transform(nettoyer)
  @IsString()
  @MinLength(3, { message: "L'objet de la réunion est obligatoire (3 caractères au moins)." })
  @MaxLength(200)
  objet!: string;

  @Type(() => Number)
  @IsInt({ message: 'Le nombre de participants doit être un nombre entier.' })
  @Min(1, { message: 'Il faut au moins 1 participant.' })
  @Max(500)
  nbParticipants!: number;

  @IsOptional()
  @Transform(nettoyerListe)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  equipementsSouhaites?: string[];

  @Transform(texteFacultatif)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  participants?: string | null;
}

/** Vérification d'un créneau avant soumission (paramètres de l'URL). */
export class DisponibiliteDto extends Creneau {
  @IsOptional()
  @IsUUID('4')
  salleId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  nbParticipants?: number;
}

/** Période affichée dans le planning (paramètres de l'URL). */
export class PeriodeDto {
  @Type(() => Date)
  @IsDate({ message: 'Début de période invalide.' })
  du!: Date;

  @Type(() => Date)
  @IsDate({ message: 'Fin de période invalide.' })
  au!: Date;
}

export class FiltreDemandesSalleDto {
  @IsOptional()
  @IsIn(Object.values(StatutDemande))
  statut?: StatutDemande;
}

/** Décision du responsable logistique. Le motif est obligatoire en cas de refus (contrôlé par le service). */
export class DecisionSalleDto {
  @IsIn(Object.values(DecisionValidation), { message: 'Décision inconnue.' })
  decision!: DecisionValidation;

  @Transform(texteFacultatif)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string | null;
}

export class CommentaireDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Le commentaire est vide.' })
  @MaxLength(1000)
  texte!: string;
}
