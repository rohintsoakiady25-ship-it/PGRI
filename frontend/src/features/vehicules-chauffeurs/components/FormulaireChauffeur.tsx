import { useState, type FormEvent } from 'react';
import { messageErreur } from '@/api/client';
import { chauffeursApi, type Chauffeur, type ChauffeurSaisie } from '../api';

interface Props {
  chauffeur: Chauffeur | null; // null = ajout
  onEnregistre: (c: Chauffeur) => void;
  onAnnuler: () => void;
}

/** Ajout ou modification d'un chauffeur (logistique, administrateur). */
export default function FormulaireChauffeur({ chauffeur, onEnregistre, onAnnuler }: Props) {
  const [valeurs, setValeurs] = useState({
    nomComplet: chauffeur?.nomComplet ?? '',
    matricule: chauffeur?.matricule ?? '',
    telephone: chauffeur?.telephone ?? '',
    numeroPermis: chauffeur?.numeroPermis ?? '',
    actif: chauffeur?.actif ?? true,
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const maj = <K extends keyof typeof valeurs>(cle: K, v: (typeof valeurs)[K]) => setValeurs((x) => ({ ...x, [cle]: v }));

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    const saisie: ChauffeurSaisie = { ...valeurs, telephone: valeurs.telephone.trim() || null, numeroPermis: valeurs.numeroPermis.trim() || null };
    try {
      onEnregistre(chauffeur ? await chauffeursApi.modifier(chauffeur.id, saisie) : await chauffeursApi.creer(saisie));
    } catch (err) {
      setErreur(messageErreur(err, "Le chauffeur n'a pas pu être enregistré."));
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
        <label htmlFor="c-nom">Nom</label>
        <input id="c-nom" required autoFocus value={valeurs.nomComplet} onChange={(e) => maj('nomComplet', e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="c-matricule">Matricule</label>
        <input id="c-matricule" required inputMode="numeric" placeholder="10421" value={valeurs.matricule}
          onChange={(e) => maj('matricule', e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="c-tel">
          Téléphone <span className="formulaire__facultatif">(facultatif)</span>
        </label>
        <input id="c-tel" type="tel" placeholder="038 09 410 66" value={valeurs.telephone}
          onChange={(e) => maj('telephone', e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="c-permis">
          N° de permis <span className="formulaire__facultatif">(facultatif)</span>
        </label>
        <input id="c-permis" value={valeurs.numeroPermis} onChange={(e) => maj('numeroPermis', e.target.value)} />
      </div>
      {chauffeur && (
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
          {envoi ? 'Enregistrement…' : chauffeur ? 'Enregistrer' : 'Ajouter le chauffeur'}
        </button>
      </div>
    </form>
  );
}
