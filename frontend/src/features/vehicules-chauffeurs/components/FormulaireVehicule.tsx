import { useState, type FormEvent } from 'react';
import { messageErreur } from '@/api/client';
import { LIBELLE_ETAT, vehiculesApi, type EtatTechnique, type Vehicule, type VehiculeSaisie } from '../api';

interface Props {
  vehicule: Vehicule | null; // null = ajout
  onEnregistre: (v: Vehicule) => void;
  onAnnuler: () => void;
}

/** Ajout ou modification d'un véhicule (logistique, administrateur). */
export default function FormulaireVehicule({ vehicule, onEnregistre, onAnnuler }: Props) {
  const [valeurs, setValeurs] = useState({
    immatriculation: vehicule?.immatriculation ?? '',
    marqueModele: vehicule?.marqueModele ?? '',
    nbPlaces: String(vehicule?.nbPlaces ?? 5),
    kilometrage: String(vehicule?.kilometrage ?? 0),
    etatTechnique: vehicule?.etatTechnique ?? ('BON' as EtatTechnique),
    actif: vehicule?.actif ?? true,
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = <K extends keyof typeof valeurs>(cle: K, v: (typeof valeurs)[K]) => setValeurs((x) => ({ ...x, [cle]: v }));

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    const saisie: VehiculeSaisie = {
      immatriculation: valeurs.immatriculation,
      marqueModele: valeurs.marqueModele,
      nbPlaces: Number(valeurs.nbPlaces),
      kilometrage: Number(valeurs.kilometrage),
      etatTechnique: valeurs.etatTechnique,
      actif: valeurs.actif,
    };
    try {
      onEnregistre(vehicule ? await vehiculesApi.modifier(vehicule.id, saisie) : await vehiculesApi.creer(saisie));
    } catch (err) {
      setErreur(messageErreur(err, "Le véhicule n'a pas pu être enregistré."));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form className="formulaire" onSubmit={soumettre} noValidate>
      {erreur && (
        <p className="formulaire__erreur" role="alert">
          {erreur}
        </p>
      )}
      <div className="formulaire__champ">
        <label htmlFor="v-immat">Immatriculation</label>
        <input id="v-immat" required autoFocus placeholder="1234 TBA" value={valeurs.immatriculation}
          onChange={(e) => maj('immatriculation', e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="v-modele">Marque et modèle</label>
        <input id="v-modele" required placeholder="Toyota Land Cruiser" value={valeurs.marqueModele}
          onChange={(e) => maj('marqueModele', e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="v-places">Nombre de places</label>
        <input id="v-places" type="number" min={1} max={60} required value={valeurs.nbPlaces}
          onChange={(e) => maj('nbPlaces', e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="v-km">Kilométrage</label>
        <input id="v-km" type="number" min={0} step={1} required value={valeurs.kilometrage}
          onChange={(e) => maj('kilometrage', e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="v-etat">État technique</label>
        <select id="v-etat" value={valeurs.etatTechnique} onChange={(e) => maj('etatTechnique', e.target.value as EtatTechnique)}>
          {(Object.keys(LIBELLE_ETAT) as EtatTechnique[]).map((k) => (
            <option key={k} value={k}>
              {LIBELLE_ETAT[k]}
            </option>
          ))}
        </select>
      </div>
      {vehicule && (
        <div className="formulaire__champ">
          <span className="formulaire__libelle">Service</span>
          <label className="formulaire__case">
            <input type="checkbox" checked={valeurs.actif} onChange={(e) => maj('actif', e.target.checked)} />
            En service
          </label>
        </div>
      )}
      <div className="formulaire__actions">
        <button type="button" className="btn btn--secondary" onClick={onAnnuler}>
          Annuler
        </button>
        <button type="submit" className="btn btn--primary" disabled={envoi}>
          {envoi ? 'Enregistrement…' : vehicule ? 'Enregistrer' : 'Ajouter le véhicule'}
        </button>
      </div>
    </form>
  );
}
