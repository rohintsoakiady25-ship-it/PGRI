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
    nbPlaces: vehicule ? String(vehicule.nbPlaces ?? '') : '5',
    etatTechnique: vehicule?.etatTechnique ?? ('BON' as EtatTechnique),
    assuranceDebut: vehicule?.assuranceDebut ?? '',
    assuranceFin: vehicule?.assuranceFin ?? '',
    visiteTechniqueDebut: vehicule?.visiteTechniqueDebut ?? '',
    visiteTechniqueFin: vehicule?.visiteTechniqueFin ?? '',
    actif: vehicule?.actif ?? true,
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = <K extends keyof typeof valeurs>(cle: K, v: (typeof valeurs)[K]) => setValeurs((x) => ({ ...x, [cle]: v }));

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (valeurs.assuranceDebut && valeurs.assuranceFin && valeurs.assuranceFin < valeurs.assuranceDebut) {
      return setErreur("La fin de l'assurance est antérieure à son début.");
    }
    if (valeurs.visiteTechniqueDebut && valeurs.visiteTechniqueFin && valeurs.visiteTechniqueFin < valeurs.visiteTechniqueDebut) {
      return setErreur('La fin de la visite technique est antérieure à son début.');
    }
    setEnvoi(true);
    const saisie: VehiculeSaisie = {
      immatriculation: valeurs.immatriculation,
      marqueModele: valeurs.marqueModele.trim() || null,
      nbPlaces: valeurs.nbPlaces.trim() ? Number(valeurs.nbPlaces) : null,
      etatTechnique: valeurs.etatTechnique,
      assuranceDebut: valeurs.assuranceDebut || null,
      assuranceFin: valeurs.assuranceFin || null,
      visiteTechniqueDebut: valeurs.visiteTechniqueDebut || null,
      visiteTechniqueFin: valeurs.visiteTechniqueFin || null,
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
        <label htmlFor="v-modele">
          Marque et modèle <span className="formulaire__facultatif">(facultatif)</span>
        </label>
        <input id="v-modele" placeholder="Toyota Land Cruiser" value={valeurs.marqueModele}
          onChange={(e) => maj('marqueModele', e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="v-places">
          Nombre de places <span className="formulaire__facultatif">(facultatif)</span>
        </label>
        <input id="v-places" type="number" min={1} max={60} value={valeurs.nbPlaces}
          onChange={(e) => maj('nbPlaces', e.target.value)} />
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
      <fieldset className="formulaire__champ formulaire__champ--large formulaire__groupe">
        <legend className="formulaire__libelle">Assurance</legend>
        <div className="formulaire__periode">
          <label>
            <span className="formulaire__facultatif">Début</span>
            <input type="date" aria-label="Début de l'assurance" value={valeurs.assuranceDebut}
              onChange={(e) => maj('assuranceDebut', e.target.value)} />
          </label>
          <label>
            <span className="formulaire__facultatif">Fin (échéance)</span>
            <input type="date" aria-label="Fin de l'assurance" min={valeurs.assuranceDebut || undefined} value={valeurs.assuranceFin}
              onChange={(e) => maj('assuranceFin', e.target.value)} />
          </label>
        </div>
      </fieldset>
      <fieldset className="formulaire__champ formulaire__champ--large formulaire__groupe">
        <legend className="formulaire__libelle">Visite technique</legend>
        <div className="formulaire__periode">
          <label>
            <span className="formulaire__facultatif">Début</span>
            <input type="date" aria-label="Début de la visite technique" value={valeurs.visiteTechniqueDebut}
              onChange={(e) => maj('visiteTechniqueDebut', e.target.value)} />
          </label>
          <label>
            <span className="formulaire__facultatif">Fin (échéance)</span>
            <input type="date" aria-label="Fin de la visite technique" min={valeurs.visiteTechniqueDebut || undefined}
              value={valeurs.visiteTechniqueFin} onChange={(e) => maj('visiteTechniqueFin', e.target.value)} />
          </label>
        </div>
      </fieldset>
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
