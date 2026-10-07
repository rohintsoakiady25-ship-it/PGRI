/**
 * Crée des comptes LOCAUX de test (développement uniquement).
 * Les identifiants et mots de passe sont dans src/database/seeds/utilisateurs-test.local.json
 * (fichier généré au premier lancement, ignoré par Git).
 * Lancement : npm run seed:test   —   comptes déjà existants : laissés tels quels.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import source from '../data-source';
import { Role } from '../../common/enums/role.enum';
import { SourceCompte } from '../../common/enums/source-compte.enum';
import { Utilisateur } from '../../modules/utilisateurs/entities/utilisateur.entity';

interface CompteTest {
  login: string;
  motDePasse: string;
  nomComplet: string;
  direction: string;
  service: string;
  roles: Role[];
  actif: boolean;
  role_teste: string;
}

const FICHIER = join(__dirname, 'utilisateurs-test.local.json');
const mdp = () => randomBytes(9).toString('base64url'); // 12 caractères

const MODELES: Omit<CompteTest, 'motDePasse'>[] = [
  { login: 'agent.test', nomComplet: 'Agent Test', direction: 'DOPE', service: 'Suivi écologique', roles: [Role.DEMANDEUR], actif: true, role_teste: 'Demandeur simple' },
  { login: 'logistique.test', nomComplet: 'Responsable Logistique Test', direction: 'DAF', service: 'Logistique', roles: [Role.DEMANDEUR, Role.LOGISTIQUE], actif: true, role_teste: 'Responsable logistique' },
  { login: 'magasinier.test', nomComplet: 'Magasinier Test', direction: 'DAF', service: 'Magasin', roles: [Role.DEMANDEUR, Role.MAGASINIER], actif: true, role_teste: 'Magasinier' },
  { login: 'assistante.test', nomComplet: 'Assistante Direction Test', direction: 'DG', service: 'Secrétariat DG', roles: [Role.DEMANDEUR, Role.ASSISTANTE_DIRECTION], actif: true, role_teste: 'Assistante de direction' },
  { login: 'admin.test', nomComplet: 'Administrateur Test', direction: 'DSII', service: 'Informatique', roles: [Role.DEMANDEUR, Role.ADMIN], actif: true, role_teste: 'Administrateur' },
  { login: 'desactive.test', nomComplet: 'Compte Désactivé Test', direction: 'DOPE', service: 'Suivi écologique', roles: [Role.DEMANDEUR], actif: false, role_teste: 'Compte désactivé : la connexion doit être refusée' },
];

function chargerComptes(): CompteTest[] {
  if (existsSync(FICHIER)) return JSON.parse(readFileSync(FICHIER, 'utf8')).comptes;
  const comptes = MODELES.map((m) => ({ ...m, motDePasse: mdp() }));
  writeFileSync(
    FICHIER,
    JSON.stringify(
      {
        avertissement: 'Comptes de TEST pour le développement local uniquement. Fichier ignoré par Git : ne pas le partager.',
        methode_de_connexion: 'Compte local',
        comptes,
      },
      null,
      2,
    ),
  );
  return comptes;
}

async function main() {
  const comptes = chargerComptes();
  await source.initialize();
  const depot = source.getRepository(Utilisateur);
  for (const c of comptes) {
    const login = c.login.toLowerCase();
    if (await depot.findOne({ where: { login, source: SourceCompte.LOCAL } })) {
      console.log(`  = ${login} (existe déjà)`);
      continue;
    }
    await depot.save(
      depot.create({
        login,
        source: SourceCompte.LOCAL,
        motDePasseHash: await bcrypt.hash(c.motDePasse, 12),
        nomComplet: c.nomComplet,
        direction: c.direction,
        service: c.service,
        roles: c.roles,
        actif: c.actif,
      }),
    );
    console.log(`  + ${login} — ${c.role_teste}`);
  }
  await source.destroy();
  console.log(`Identifiants et mots de passe : ${FICHIER}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
