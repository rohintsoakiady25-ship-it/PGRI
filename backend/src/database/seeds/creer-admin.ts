/**
 * Crée le premier compte local administrateur à partir de backend/.env :
 *   ADMIN_LOGIN, ADMIN_MOT_DE_PASSE, ADMIN_NOM, ADMIN_EMAIL (facultatif)
 * Lancement : npm run seed:admin
 * Compte déjà existant : seule son adresse e-mail est mise à jour (si ADMIN_EMAIL est renseigné).
 */
import * as bcrypt from 'bcryptjs';
import source from '../data-source';
import { Role } from '../../common/enums/role.enum';
import { SourceCompte } from '../../common/enums/source-compte.enum';
import { Utilisateur } from '../../modules/utilisateurs/entities/utilisateur.entity';

async function main() {
  const login = (process.env.ADMIN_LOGIN ?? '').trim().toLowerCase();
  const motDePasse = process.env.ADMIN_MOT_DE_PASSE ?? '';
  const nom = process.env.ADMIN_NOM?.trim() || 'Administrateur PGRI';
  const email = process.env.ADMIN_EMAIL?.trim() || null;
  if (!login || motDePasse.length < 12) {
    throw new Error('Renseignez ADMIN_LOGIN et ADMIN_MOT_DE_PASSE (12 caractères minimum) dans backend/.env.');
  }

  await source.initialize();
  const depot = source.getRepository(Utilisateur);
  const existant = await depot.findOne({ where: { login, source: SourceCompte.LOCAL } });
  if (existant) {
    if (email && existant.email !== email) {
      await depot.update(existant.id, { email });
      console.log(`Compte local « ${login} » : adresse e-mail mise à jour.`);
    } else {
      console.log(`Le compte local « ${login} » existe déjà : rien à faire.`);
    }
  } else {
    await depot.save(
      depot.create({
        login,
        source: SourceCompte.LOCAL,
        motDePasseHash: await bcrypt.hash(motDePasse, 12),
        nomComplet: nom,
        email,
        roles: [Role.DEMANDEUR, Role.ADMIN],
        actif: true,
      }),
    );
    console.log(`Compte local administrateur « ${login} » créé.`);
  }
  await source.destroy();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
