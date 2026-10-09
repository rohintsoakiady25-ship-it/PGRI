/**
 * Importe la liste des chauffeurs MNP depuis src/database/seeds/chauffeurs.local.json
 * (données personnelles : fichier ignoré par Git).
 * Lancement : npm run seed:chauffeurs   —   chauffeur déjà présent (même matricule) : mis à jour d'après le fichier.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import source from '../data-source';
import { Chauffeur } from '../../modules/chauffeurs/entities/chauffeur.entity';

interface LigneChauffeur {
  nomComplet: string;
  telephone?: string | null;
  matricule: string;
  numeroPermis?: string | null;
}

const FICHIER = join(__dirname, 'chauffeurs.local.json');

async function main() {
  if (!existsSync(FICHIER)) throw new Error(`Fichier introuvable : ${FICHIER}`);
  const lignes: LigneChauffeur[] = JSON.parse(readFileSync(FICHIER, 'utf8')).chauffeurs;
  await source.initialize();
  const depot = source.getRepository(Chauffeur);
  for (const l of lignes) {
    const matricule = l.matricule.trim();
    const existant = await depot.findOne({ where: { matricule } });
    const c = existant ?? depot.create({ matricule, actif: true });
    c.nomComplet = l.nomComplet.trim();
    c.telephone = l.telephone?.trim() || null;
    c.numeroPermis = l.numeroPermis?.trim().toUpperCase() || null;
    await depot.save(c);
    console.log(`  ${existant ? '~' : '+'} ${matricule} — ${c.nomComplet}${existant ? ' (mis à jour)' : ''}`);
  }
  await source.destroy();
  console.log(`${lignes.length} chauffeur(s) importé(s).`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
