import { useState, type FormEvent } from 'react';
import { messageErreur } from '@/api/client';
import { sallesApi, type Salle, type SalleSaisie } from '../api';

interface Props {
  salle: Salle | null; // null = ajout
  onEnregistre: (s: Salle) => void;
  onAnnuler: () => void;
}

/** Ajout ou modification d'une salle (logistique, administrateur). */
export default function FormulaireSalle({ salle, onEnregistre, onAnnuler }: Props) {
  const [valeurs, setValeurs] = useState({
    nom: salle?.nom ?? '',
    capacite: String(salle?.capacite ?? ''),
    localisation: salle?.localisation ?? '',
    actif: salle?.actif ?? true,
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = <K extends keyof typeof valeurs>(cle: K, v: (typeof valeurs)[K]) => setValeurs((x) => ({ ...x, [cle]: v }));

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    const saisie: SalleSaisie = {
      nom: valeurs.nom,
      capacite: Number(valeurs.capacite),
      localisation: valeurs.localisation.trim() || null,
      actif: valeurs.actif,
    };
    try {
      onEnregistre(salle ? await sallesApi.modifier(salle.id, saisie) : await sallesApi.creer(saisie));
    } catch (err) {
      setErreur(messageErreur(err, "La salle n'a pas pu être enregistrée."));
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
        <label htmlFor="s-nom">Nom</label>
        <input id="s-nom" required autoFocus placeholder="Salle 1" value={valeurs.nom} onChange={(e) => maj('nom', e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="s-capacite">Capacité (places)</label>
        <input id="s-capacite" type="number" min={1} max={500} required value={valeurs.capacite}
          onChange={(e) => maj('capacite', e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="s-localisation">
          Localisation <span className="formulaire__facultatif">(facultatif)</span>
        </label>
        <input id="s-localisation" placeholder="Siège, 1er étage" value={valeurs.localisation}
          onChange={(e) => maj('localisation', e.target.value)} />
      </div>
      {salle && (
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
          {envoi ? 'Enregistrement…' : salle ? 'Enregistrer' : 'Ajouter la salle'}
        </button>
      </div>
    </form>
  );
}
