import { useEffect, useState } from 'react';
import { messageErreur } from '@/api/client';
import { dateHeure } from '@/features/salles/api';
import { demandesDeplacementApi, type ChoixLogistique, type OptionsAffectation } from '../api';

interface Props {
  id: string;
  envoi: boolean;
  onDecider: (decision: 'VALIDEE' | 'REFUSEE', choix: ChoixLogistique, commentaire: string | null) => void;
}

const refs = (c: { references: string[] }[]) => c.flatMap((x) => x.references).join(', ');

/**
 * Décision du responsable logistique : un véhicule et un chauffeur libres sur la période,
 * ou le regroupement avec une affectation déjà prévue ; ou un refus motivé.
 */
export default function ChoixAffectation({ id, envoi, onDecider }: Props) {
  const [options, setOptions] = useState<OptionsAffectation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [mode, setMode] = useState<'nouvelle' | 'regrouper'>('nouvelle');
  const [vehiculeId, setVehiculeId] = useState('');
  const [chauffeurId, setChauffeurId] = useState('');
  const [affectationId, setAffectationId] = useState('');
  const [commentaire, setCommentaire] = useState('');

  useEffect(() => {
    demandesDeplacementApi
      .optionsAffectation(id)
      .then((o) => {
        setOptions(o);
        setVehiculeId(o.vehicules.find((v) => v.libre)?.id ?? '');
        setChauffeurId(o.chauffeurs.find((c) => c.libre)?.id ?? '');
        setAffectationId(o.regroupements.find((g) => g.possible)?.id ?? '');
      })
      .catch((e) => setErreur(messageErreur(e, 'Les véhicules et chauffeurs n’ont pas pu être chargés.')));
  }, [id]);

  if (!options) return <p className="detail__discret">{erreur ?? 'Chargement des véhicules et chauffeurs…'}</p>;

  const vehicule = options.vehicules.find((v) => v.id === vehiculeId);
  const libres = options.vehicules.filter((v) => v.libre).length;
  const regroupables = options.regroupements.filter((g) => g.possible);

  function valider() {
    setErreur(null);
    if (mode === 'regrouper') {
      if (!affectationId) return setErreur('Choisissez l’affectation à partager.');
      onDecider('VALIDEE', { affectationId }, commentaire.trim() || null);
    } else {
      if (!vehiculeId || !chauffeurId) return setErreur('Choisissez un véhicule et un chauffeur.');
      onDecider('VALIDEE', { vehiculeId, chauffeurId }, commentaire.trim() || null);
    }
  }

  function refuser() {
    setErreur(null);
    if (!commentaire.trim()) return setErreur('Indiquez le motif du refus : il sera communiqué au demandeur.');
    onDecider('REFUSEE', {}, commentaire.trim());
  }

  return (
    <section className="detail__bloc detail__bloc--decision" aria-labelledby="decision-log-titre">
      <h3 id="decision-log-titre" className="detail__titre">Votre décision (responsable logistique)</h3>
      {erreur && (
        <p className="formulaire__erreur" role="alert">
          {erreur}
        </p>
      )}

      {options.regroupements.length > 0 && (
        <fieldset className="affectation__modes">
          <legend className="sr-only">Mode d’affectation</legend>
          <label className="formulaire__case">
            <input type="radio" name="mode-affectation" checked={mode === 'nouvelle'} onChange={() => setMode('nouvelle')} />
            Affecter un véhicule et un chauffeur
          </label>
          <label className="formulaire__case">
            <input type="radio" name="mode-affectation" checked={mode === 'regrouper'} onChange={() => setMode('regrouper')} />
            Regrouper avec une mission prévue ({regroupables.length} possible{regroupables.length > 1 ? 's' : ''})
          </label>
        </fieldset>
      )}

      {mode === 'nouvelle' ? (
        <div className="detail__appareils">
          <label className="detail__appareil">
            <span>Véhicule</span>
            <select value={vehiculeId} onChange={(e) => setVehiculeId(e.target.value)}>
              <option value="" disabled>
                {libres ? 'Choisir un véhicule' : 'Aucun véhicule libre sur cette période'}
              </option>
              {options.vehicules.map((v) => (
                <option key={v.id} value={v.id} disabled={!v.libre}>
                  {v.immatriculation}
                  {v.marqueModele ? ` · ${v.marqueModele}` : ''}
                  {v.nbPlaces ? ` · ${v.nbPlaces} places` : ''}
                  {v.bloquant ? ` — ${v.bloquant}` : v.conflits.length ? ` — déjà affecté (${refs(v.conflits)})` : ''}
                </option>
              ))}
            </select>
          </label>
          {vehicule && vehicule.avertissements.length > 0 && (
            <p className="affectation__alerte">{vehicule.avertissements.join(' · ')}</p>
          )}
          <label className="detail__appareil">
            <span>Chauffeur</span>
            <select value={chauffeurId} onChange={(e) => setChauffeurId(e.target.value)}>
              <option value="" disabled>
                Choisir un chauffeur
              </option>
              {options.chauffeurs.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.libre}>
                  {c.nomComplet}
                  {c.telephone ? ` · ${c.telephone}` : ''}
                  {c.conflits.length ? ` — conduit déjà (${refs(c.conflits)})` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <fieldset className="affectation__regroupements">
          <legend className="detail__libelle">Mission à partager</legend>
          {options.regroupements.map((g) => (
            <label key={g.id} className={`affectation__mission${g.possible ? '' : ' affectation__mission--impossible'}`}>
              <input type="radio" name="regroupement" disabled={!g.possible} checked={affectationId === g.id} onChange={() => setAffectationId(g.id)} />
              <span>
                <strong>{g.vehicule.immatriculation}</strong> · {g.chauffeur.nomComplet}
                <span className="detail__discret">
                  {' '}
                  · {dateHeure(g.debut)} → {dateHeure(g.fin)} · {g.demandes.map((x) => `${x.reference} (${x.destination})`).join(', ')}
                  {!g.possible && ' · impossible : la période élargie crée un conflit'}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <label className="detail__libelle" htmlFor="motif-log">
        Commentaire <span className="formulaire__facultatif">(obligatoire pour un refus)</span>
      </label>
      <textarea id="motif-log" rows={2} maxLength={1000} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
      <div className="detail__boutons">
        <button type="button" className="btn btn--secondary" disabled={envoi} onClick={refuser}>
          Refuser
        </button>
        <button type="button" className="btn btn--primary" disabled={envoi} onClick={valider}>
          Valider et affecter
        </button>
      </div>
    </section>
  );
}
