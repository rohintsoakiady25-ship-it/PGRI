/**
 * Importe le parc automobile depuis src/database/seeds/vehicules.local.json
 * (extrait de la liste Excel de la logistique ; fichier ignoré par Git).
 * Lancement : npm run seed:vehicules   —   véhicule déjà présent (même immatriculation) :
 * seules ses dates d'assurance et de visite technique sont mises à jour d'après le fichier.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import source from '../data-source';
import { EtatTechnique } from '../../common/enums/etat-technique.enum';
import { Vehicule } from '../../modules/ressources/entities/vehicule.entity';

interface LigneVehicule {
  immatriculation: string;
  /** Dates « AAAA-MM-JJ » ou null. */
  assuranceDebut: string | null;
  assuranceFin: string | null;
  visiteTechniqueDebut: string | null;
  visiteTechniqueFin: string | null;
}

const FICHIER = join(__dirname, 'vehicules.local.json');

async function main() {
  if (!existsSync(FICHIER)) throw new Error(`Fichier introuvable : ${FICHIER}`);
  const lignes: LigneVehicule[] = JSON.parse(readFileSync(FICHIER, 'utf8')).vehicules;
  await source.initialize();
  const depot = source.getRepository(Vehicule);
  for (const l of lignes) {
    const immatriculation = l.immatriculation.trim().replace(/\s+/g, ' ').toUpperCase();
    const existant = await depot.findOne({ where: { immatriculation } });
    const v =
      existant ??
      depot.create({ immatriculation, nom: immatriculation, marqueModele: null, nbPlaces: null, etatTechnique: EtatTechnique.BON, actif: true });
    v.assuranceDebut = l.assuranceDebut;
    v.assuranceFin = l.assuranceFin;
    v.visiteTechniqueDebut = l.visiteTechniqueDebut;
    v.visiteTechniqueFin = l.visiteTechniqueFin;
    await depot.save(v);
    console.log(`  ${existant ? '~' : '+'} ${immatriculation}${existant ? ' (dates mises à jour)' : ''}`);
  }
  await source.destroy();
  console.log(`${lignes.length} véhicule(s) importé(s).`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
