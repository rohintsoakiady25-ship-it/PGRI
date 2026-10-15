/**
 * Crée des comptes LOCAUX de test (développement uniquement).
 * Les identifiants et mots de passe sont dans src/database/seeds/utilisateurs-test.local.json
 * (fichier généré au premier lancement, ignoré par Git).
 * Lancement : npm run seed:test   —   comptes déjà existants : mis à jour d'après le fichier
 * (pour changer un mot de passe de test : modifier le fichier puis relancer).
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
  /** Adresse des e-mails automatiques (les comptes AD ont celle de l'annuaire). */
  email: string;
  roles: Role[];
  actif: boolean;
  role_teste: string;
  /** Login du supérieur direct (N+1), facultatif. */
  superieur?: string;
}

const FICHIER = join(__dirname, 'utilisateurs-test.local.json');
const mdp = () => randomBytes(9).toString('base64url'); // 12 caractères

/** Boîte qui reçoit les e-mails de test (EMAIL_COMPTES_TEST) ; la logistique locale utilise la boîte de la plateforme. */
const EMAIL_TEST = process.env.EMAIL_COMPTES_TEST?.trim() ?? '';
const EMAIL_LOGISTIQUE = process.env.MAIL_SENDER_ADDRESS?.trim() ?? '';

const MODELES: Omit<CompteTest, 'motDePasse'>[] = [
  { login: 'agent.test', nomComplet: 'Agent Test', direction: 'DOPE', service: 'Suivi écologique', email: EMAIL_TEST, roles: [Role.DEMANDEUR], actif: true, role_teste: 'Demandeur simple (N+1 : chef.test)', superieur: 'chef.test' },
  { login: 'chef.test', nomComplet: 'Chef de Service Test', direction: 'DOPE', service: 'Suivi écologique', email: EMAIL_TEST, roles: [Role.DEMANDEUR], actif: true, role_teste: 'Supérieur direct (N+1) de agent.test' },
  { login: 'logistique.test', nomComplet: 'Responsable Logistique Test', direction: 'DAF', service: 'Logistique', email: EMAIL_LOGISTIQUE, roles: [Role.DEMANDEUR, Role.LOGISTIQUE], actif: true, role_teste: 'Responsable logistique' },
  { login: 'magasinier.test', nomComplet: 'Magasinier Test', direction: 'DAF', service: 'Magasin', email: EMAIL_TEST, roles: [Role.DEMANDEUR, Role.MAGASINIER], actif: true, role_teste: 'Magasinier' },
  { login: 'assistante.test', nomComplet: 'Assistante Direction Test', direction: 'DOPE', service: 'Secrétariat DOPE', email: EMAIL_TEST, roles: [Role.DEMANDEUR, Role.ASSISTANTE_DIRECTION], actif: true, role_teste: 'Assistante de direction (DOPE : voit les demandes de agent.test)' },
  { login: 'admin.test', nomComplet: 'Administrateur Test', direction: 'DSII', service: 'Informatique', email: EMAIL_TEST, roles: [Role.DEMANDEUR, Role.ADMIN], actif: true, role_teste: 'Administrateur' },
  { login: 'desactive.test', nomComplet: 'Compte Désactivé Test', direction: 'DOPE', service: 'Suivi écologique', email: EMAIL_TEST, roles: [Role.DEMANDEUR], actif: false, role_teste: 'Compte désactivé : la connexion doit être refusée' },
];

function chargerComptes(): CompteTest[] {
  if (existsSync(FICHIER)) {
    // Fichier existant : on garde ses valeurs et on y ajoute les comptes de test apparus depuis
    const contenu = JSON.parse(readFileSync(FICHIER, 'utf8'));
    const connus = new Set(contenu.comptes.map((c: CompteTest) => c.login));
    const nouveaux = MODELES.filter((m) => !connus.has(m.login)).map((m) => ({ ...m, motDePasse: mdp() }));
    // Comptes créés avant l'ajout des e-mails : on reprend l'adresse du modèle
    const sansEmail = contenu.comptes.filter((c: CompteTest) => !c.email);
    for (const c of sansEmail) c.email = MODELES.find((m) => m.login === c.login)?.email || EMAIL_TEST;
    if (nouveaux.length || sansEmail.length) {
      contenu.comptes.push(...nouveaux);
      writeFileSync(FICHIER, JSON.stringify(contenu, null, 2));
    }
    return contenu.comptes;
  }
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
    const existant = await depot.findOne({ where: { login, source: SourceCompte.LOCAL } });
    // Comptes de test : le fichier fait foi (mot de passe, rôles, état) à chaque lancement
    const u = existant ?? depot.create({ login, source: SourceCompte.LOCAL });
    u.motDePasseHash = await bcrypt.hash(c.motDePasse, 12);
    u.nomComplet = c.nomComplet;
    u.direction = c.direction;
    u.service = c.service;
    u.email = c.email || null;
    u.roles = c.roles;
    u.actif = c.actif;
    await depot.save(u);
    console.log(`  ${existant ? '~' : '+'} ${login} — ${c.role_teste}${existant ? ' (mis à jour)' : ''}`);
  }
  // Liens N+1, une fois tous les comptes créés
  for (const c of comptes) {
    const superieur = c.superieur ? await depot.findOne({ where: { login: c.superieur.toLowerCase(), source: SourceCompte.LOCAL } }) : null;
    await depot.update({ login: c.login.toLowerCase(), source: SourceCompte.LOCAL }, { superieurDirectId: superieur?.id ?? null });
  }
  await source.destroy();
  console.log(`Identifiants et mots de passe : ${FICHIER}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
