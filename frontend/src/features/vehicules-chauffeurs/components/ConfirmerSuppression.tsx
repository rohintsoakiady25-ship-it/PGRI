import { useState } from 'react';
import { messageErreur } from '@/api/client';

interface Props {
  nom: string;
  supprimer: () => Promise<void>;
  onSupprime: () => void;
  onAnnuler: () => void;
}

/** Confirmation avant une suppression définitive (logistique, administrateur). */
export default function ConfirmerSuppression({ nom, supprimer, onSupprime, onAnnuler }: Props) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function confirmer() {
    setErreur(null);
    setEnvoi(true);
    try {
      await supprimer();
      onSupprime();
    } catch (err) {
      setErreur(messageErreur(err, "La suppression n'a pas pu être effectuée."));
      setEnvoi(false);
    }
  }

  return (
    <div className="formulaire">
      {erreur && (
        <p className="formulaire__erreur" role="alert">
          {erreur}
        </p>
      )}
      <p className="formulaire__champ--large">
        <strong>{nom}</strong> sera supprimé définitivement. Pour le retirer seulement des affectations, utilisez plutôt
        « Modifier » puis décochez « En service ».
      </p>
      <div className="formulaire__actions">
        <button type="button" className="btn btn--secondary" onClick={onAnnuler} autoFocus>
          Annuler
        </button>
        <button type="button" className="btn btn--danger" onClick={confirmer} disabled={envoi}>
          {envoi ? 'Suppression…' : 'Supprimer'}
        </button>
      </div>
    </div>
  );
}
