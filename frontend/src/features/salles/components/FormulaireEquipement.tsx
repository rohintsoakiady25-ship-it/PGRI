import { useState, type FormEvent } from 'react';
import { messageErreur } from '@/api/client';
import { equipementsApi, type Equipement, type EquipementSaisie, type Salle } from '../api';

interface Props {
  equipement: Equipement | null; // null = ajout
  salles: Salle[];
  onEnregistre: (e: Equipement) => void;
  onAnnuler: () => void;
}

/**
 * Ajout ou modification d'un équipement (logistique, administrateur).
 * Rattachement : une seule salle (choix unique) ou plusieurs salles (cases à cocher).
 */
export default function FormulaireEquipement({ equipement, salles, onEnregistre, onAnnuler }: Props) {
  const [nom, setNom] = useState(equipement?.nom ?? '');
  const [description, setDescription] = useState(equipement?.description ?? '');
  const [plusieursSalles, setPlusieursSalles] = useState(equipement?.plusieursSalles ?? false);
  const [salleIds, setSalleIds] = useState<string[]>(equipement?.salles.map((s) => s.id) ?? []);
  const [actif, setActif] = useState(equipement?.actif ?? true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  function changerRattachement(plusieurs: boolean) {
    setPlusieursSalles(plusieurs);
    // Passage à « une seule salle » : on ne garde que la première salle cochée
    if (!plusieurs) setSalleIds((ids) => ids.slice(0, 1));
  }

  function basculerSalle(id: string, coche: boolean) {
    setSalleIds((ids) => (plusieursSalles ? (coche ? [...ids, id] : ids.filter((x) => x !== id)) : [id]));
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    const saisie: EquipementSaisie = { nom, description: description.trim() || null, plusieursSalles, salleIds, actif };
    try {
      onEnregistre(equipement ? await equipementsApi.modifier(equipement.id, saisie) : await equipementsApi.creer(saisie));
    } catch (err) {
      setErreur(messageErreur(err, "L'équipement n'a pas pu être enregistré."));
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
        <label htmlFor="eq-nom">Nom</label>
        <input id="eq-nom" required autoFocus maxLength={100} placeholder="Vidéoprojecteur" value={nom} onChange={(e) => setNom(e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="eq-description">
          Description <span className="formulaire__facultatif">(facultatif)</span>
        </label>
        <input id="eq-description" maxLength={255} placeholder="Marque, modèle, remarque…" value={description}
          onChange={(e) => setDescription(e.target.value)} />
      </div>

      <fieldset className="formulaire__champ formulaire__champ--large formulaire__groupe">
        <legend className="formulaire__libelle">Rattachement</legend>
        <div className="formulaire__choix">
          <label className="formulaire__case">
            <input type="radio" name="rattachement" checked={!plusieursSalles} onChange={() => changerRattachement(false)} />
            Une seule salle <span className="formulaire__facultatif">(matériel installé)</span>
          </label>
          <label className="formulaire__case">
            <input type="radio" name="rattachement" checked={plusieursSalles} onChange={() => changerRattachement(true)} />
            Plusieurs salles <span className="formulaire__facultatif">(matériel partagé)</span>
          </label>
        </div>
      </fieldset>

      <fieldset className="formulaire__champ formulaire__champ--large formulaire__groupe">
        <legend className="formulaire__libelle">{plusieursSalles ? 'Salles où il est disponible' : 'Salle où il est installé'}</legend>
        {salles.length === 0 ? (
          <p className="formulaire__facultatif">Aucune salle enregistrée. Ajoutez d’abord les salles dans « Liste des salles ».</p>
        ) : (
          <div className="formulaire__choix">
            {salles.map((s) => (
              <label key={s.id} className="formulaire__case">
                <input
                  type={plusieursSalles ? 'checkbox' : 'radio'}
                  name="salles"
                  checked={salleIds.includes(s.id)}
                  onChange={(e) => basculerSalle(s.id, e.target.checked)}
                />
                {s.nom}
                {!s.actif && <span className="formulaire__facultatif">(hors service)</span>}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {equipement && (
        <div className="formulaire__champ">
          <span className="formulaire__libelle">Service</span>
          <label className="formulaire__case">
            <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
            En service
          </label>
        </div>
      )}
      <div className="formulaire__actions">
        <button type="button" className="btn btn--secondary" onClick={onAnnuler}>
          Annuler
        </button>
        <button type="submit" className="btn btn--primary" disabled={envoi}>
          {envoi ? 'Enregistrement…' : equipement ? 'Enregistrer' : 'Ajouter l’équipement'}
        </button>
      </div>
    </form>
  );
}
