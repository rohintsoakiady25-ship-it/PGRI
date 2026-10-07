import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export type MethodeConnexion = 'ad' | 'local';

export class ConnexionDto {
  @IsIn(['ad', 'local'], { message: 'Méthode de connexion inconnue.' })
  methode!: MethodeConnexion;

  @IsString()
  @IsNotEmpty({ message: "L'identifiant est obligatoire." })
  @MaxLength(100)
  identifiant!: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MaxLength(256)
  motDePasse!: string;
}
