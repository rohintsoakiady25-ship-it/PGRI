import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { UtilisateursModule } from './modules/utilisateurs/utilisateurs.module';
import { RessourcesModule } from './modules/ressources/ressources.module';
import { ChauffeursModule } from './modules/chauffeurs/chauffeurs.module';
import { DemandesModule } from './modules/demandes/demandes.module';
import { DeplacementsModule } from './modules/deplacements/deplacements.module';
import { SallesModule } from './modules/salles/salles.module';
import { FournituresModule } from './modules/fournitures/fournitures.module';
import { ConflitsModule } from './modules/conflits/conflits.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CartographieModule } from './modules/cartographie/cartographie.module';
import { AnalytiqueModule } from './modules/analytique/analytique.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.user'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        autoLoadEntities: true,
        synchronize: config.get<boolean>('database.synchronize'),
      }),
    }),
    AuthModule,
    UtilisateursModule,
    RessourcesModule,
    ChauffeursModule,
    DemandesModule,
    DeplacementsModule,
    SallesModule,
    FournituresModule,
    ConflitsModule,
    NotificationsModule,
    CartographieModule,
    AnalytiqueModule,
  ],
})
export class AppModule {}
