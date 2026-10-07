import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UtilisateursModule } from '../utilisateurs/utilisateurs.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LdapService } from './ldap.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/** Authentification : Active Directory (LDAP/LDAPS) ou compte local, puis jeton JWT. */
@Module({
  imports: [
    UtilisateursModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('jwt.secret') ?? '';
        if (secret.length < 32) {
          throw new Error('JWT_SECRET absent ou trop court dans backend/.env (32 caractères minimum).');
        }
        return { secret, signOptions: { expiresIn: config.get<string>('jwt.expiresIn') as `${number}h` } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LdapService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
