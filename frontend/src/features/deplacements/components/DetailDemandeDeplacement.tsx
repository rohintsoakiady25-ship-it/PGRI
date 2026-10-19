import { useEffect, useState } from 'react';
import Badge from '@/components/common/Badge';
import { messageErreur } from '@/api/client';
import { dateHeure } from '@/features/salles/api';
import '@/features/salles/components/DetailDemandeSalle.css';
import ChoixAffectation from './ChoixAffectation';
import './DetailDemandeDeplacement.css';
import {
  demandesDeplacementApi, LIBELLE_STATUT_DEPLACEMENT, LIBELLE_TYPE, periode, TON_STATUT_DEPLACEMENT, type DetailDemandeDeplacement,
} from '../api';

interface Props {
  id: string;
  /** Après une action (décision, annulation) : la liste se met à jour. */
  onModifiee: () => void;
}

const km = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/** Maintenant, au format d'un champ datetime-local (heure locale). */
function maintenantLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Détail d'une demande de déplacement : trajet, dates, décisions, annulation, historique. */
export default function DetailDemandeDeplacement({ id, onModifiee }: Props) {
  const [d, setD] = useState<DetailDemandeDeplacement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false);
  const [motif, setMotif] = useState('');
  const [heureRetour, setHeureRetour] = useState(maintenantLocal);
  const [incidents, setIncidents] = useState('');

  useEffect(() => {
    demandesDeplacementApi.detail(id).then(setD).catch((e) => setErreur(messageErreur(e, 'La demande n’a pas pu être chargée.')));
  }, [id]);

  async function agir(action: () => Promise<DetailDemandeDeplacement>, apres?: () => void) {
    setErreur(null);
    setEnvoi(true);
    try {
      setD(await action());
      apres?.();
      onModifiee();
    } catch (e) {
      setErreur(messageErreur(e, "L'action n'a pas pu être effectuée."));
    } finally {
      setEnvoi(false);
    }
  }

  function decider(decision: 'VALIDEE' | 'REFUSEE') {
    if (decision === 'REFUSEE' && !motif.trim()) {
      setErreur('Indiquez le motif du refus : il sera communiqué au demandeur.');
      return;
    }
    agir(() => demandesDeplacementApi.deciderN1(id, decision, motif.trim() || null), () => setMotif(''));
  }

  if (!d) return <p className="detail__chargement">{erreur ?? 'Chargement…'}</p>;

  return (
    <div className="detail">
      <div className="detail__entete">
        <span className="detail__reference">{d.reference}</span>
        <Badge ton={TON_STATUT_DEPLACEMENT[d.statut]}>{LIBELLE_STATUT_DEPLACEMENT[d.statut]}</Badge>
      </div>

      {erreur && (
        <p className="formulaire__erreur" role="alert">
          {erreur}
        </p>
      )}

      <dl className="detail__infos">
        <dt>Type</dt>
        <dd>
          {LIBELLE_TYPE[d.typeDeplacement]}
          {d.dureeMissionJours && <span className="detail__discret"> · {d.dureeMissionJours} jour{d.dureeMissionJours > 1 ? 's' : ''}</span>}
        </dd>
        <dt>Trajet</dt>
        <dd>
          {d.lieuDepart} → {d.destination}
          {d.distanceEstimeeKm !== null && <span className="detail__discret"> · environ {km(d.distanceEstimeeKm)} km par la route</span>}
        </dd>
        <dt>Dates</dt>
        <dd>{periode(d.dateHeureDepart, d.dateHeureRetourPrevue)}</dd>
        <dt>Motif</dt>
        <dd>{d.motif}</dd>
        {d.personnesConcernees && (
          <>
            <dt>Personnes</dt>
            <dd>
              <span className="detail__liste">{d.personnesConcernees}</span>
            </dd>
          </>
        )}
        <dt>Demandeur</dt>
        <dd>
          {d.demandeur.nomComplet}
          {(d.demandeur.direction || d.demandeur.service) && (
            <span className="detail__discret"> · {[d.demandeur.direction, d.demandeur.service].filter(Boolean).join(' · ')}</span>
          )}
        </dd>
        {d.affectation && (
          <>
            <dt>Véhicule</dt>
            <dd>
              <strong>{d.affectation.vehicule.immatriculation}</strong>
              {d.affectation.vehicule.marqueModele && <span className="detail__discret"> · {d.affectation.vehicule.marqueModele}</span>}
            </dd>
            <dt>Chauffeur</dt>
            <dd>
              {d.affectation.chauffeur.nomComplet}
              {d.affectation.chauffeur.telephone && <span className="detail__discret"> · {d.affectation.chauffeur.telephone}</span>}
            </dd>
            {d.affectation.heureDepartReelle && (
              <>
                <dt>Départ réel</dt>
                <dd>{dateHeure(d.affectation.heureDepartReelle)}</dd>
              </>
            )}
            {d.affectation.heureRetourReelle && (
              <>
                <dt>Retour réel</dt>
                <dd>{dateHeure(d.affectation.heureRetourReelle)}</dd>
              </>
            )}
            {d.affectation.incidents && (
              <>
                <dt>Incidents</dt>
                <dd>
                  <span className="detail__liste">{d.affectation.incidents}</span>
                </dd>
              </>
            )}
          </>
        )}
        {d.soumisLe && (
          <>
            <dt>Envoyée le</dt>
            <dd>{dateHeure(d.soumisLe)}</dd>
          </>
        )}
      </dl>

      {d.validations.length > 0 && (
        <section className="detail__bloc" aria-labelledby="decisions-titre">
          <h3 id="decisions-titre" className="detail__titre">Décisions</h3>
          <ul className="detail__commentaires">
            {d.validations.map((v, i) => (
              <li key={i}>
                <span className="detail__auteur">
                  {v.niveau === 'N1' ? 'Supérieur direct' : 'Responsable logistique'} : {v.decision === 'VALIDEE' ? 'validée' : 'refusée'}
                  <span className="detail__discret"> · {v.validateur?.nomComplet ?? '—'} · {dateHeure(v.date)}</span>
                </span>
                {v.commentaire && <p>{v.commentaire}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.actions.deciderN1 && (
        <section className="detail__bloc detail__bloc--decision" aria-labelledby="decision-titre">
          <h3 id="decision-titre" className="detail__titre">Votre décision (supérieur direct)</h3>
          <p className="detail__discret">
            Validée, la demande part au responsable logistique, qui affecte un véhicule et un chauffeur.
          </p>
          <label className="detail__libelle" htmlFor="motif-n1">
            Commentaire <span className="formulaire__facultatif">(obligatoire pour un refus)</span>
          </label>
          <textarea id="motif-n1" rows={2} maxLength={1000} value={motif} onChange={(e) => setMotif(e.target.value)} />
          <div className="detail__boutons">
            <button type="button" className="btn btn--secondary" disabled={envoi} onClick={() => decider('REFUSEE')}>
              Refuser
            </button>
            <button type="button" className="btn btn--primary" disabled={envoi} onClick={() => decider('VALIDEE')}>
              Valider la demande
            </button>
          </div>
        </section>
      )}

      {d.actions.deciderLogistique && (
        <ChoixAffectation
          id={d.id}
          envoi={envoi}
          onDecider={(decision, choix, commentaire) => agir(() => demandesDeplacementApi.deciderLogistique(id, decision, choix, commentaire))}
        />
      )}

      {(d.actions.depart || d.actions.retour) && (
        <section className="detail__bloc detail__bloc--decision" aria-labelledby="mission-titre">
          <h3 id="mission-titre" className="detail__titre">Suivi de la mission</h3>
          {d.actions.depart ? (
            <>
              <p className="detail__discret">
                Départ prévu le {dateHeure(d.dateHeureDepart)}. Les demandes regroupées sur ce véhicule passent aussi « En cours ».
              </p>
              <div className="detail__boutons">
                <button type="button" className="btn btn--primary" disabled={envoi}
                  onClick={() => agir(() => demandesDeplacementApi.depart(id))}>
                  Enregistrer le départ
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="detail__libelle" htmlFor="heure-retour">Heure de retour réelle</label>
              <input id="heure-retour" className="mission__heure" type="datetime-local" value={heureRetour} max={maintenantLocal()}
                onChange={(e) => setHeureRetour(e.target.value)} />
              <label className="detail__libelle" htmlFor="incidents">
                Incidents <span className="formulaire__facultatif">(facultatif)</span>
              </label>
              <textarea id="incidents" rows={2} maxLength={2000} placeholder="Panne, accident, retard…" value={incidents}
                onChange={(e) => setIncidents(e.target.value)} />
              <div className="detail__boutons">
                <button type="button" className="btn btn--primary" disabled={envoi || !heureRetour}
                  onClick={() => agir(() => demandesDeplacementApi.retour(id, new Date(heureRetour).toISOString(), incidents.trim() || null))}>
                  Enregistrer le retour
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {d.actions.annuler && (
        <div className="detail__annulation">
          {confirmerAnnulation ? (
            <>
              <span>Annuler cette demande ?</span>
              <button type="button" className="btn btn--petit" onClick={() => setConfirmerAnnulation(false)}>
                Non
              </button>
              <button type="button" className="btn btn--petit btn--petit-danger" disabled={envoi}
                onClick={() => agir(() => demandesDeplacementApi.annuler(id), () => setConfirmerAnnulation(false))}>
                Oui, annuler
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--petit btn--petit-danger" onClick={() => setConfirmerAnnulation(true)}>
              Annuler la demande
            </button>
          )}
        </div>
      )}

      <section className="detail__bloc" aria-labelledby="historique-titre">
        <h3 id="historique-titre" className="detail__titre">Historique</h3>
        <ol className="detail__historique">
          {d.historique.map((h, i) => (
            <li key={i}>
              <span className="detail__discret">{dateHeure(h.date)}</span>{' '}
              <strong>{LIBELLE_STATUT_DEPLACEMENT[h.nouveauStatut] ?? h.nouveauStatut}</strong>
              {h.auteur ? ` par ${h.auteur.nomComplet}` : ' (automatique)'}
              {h.commentaire && <span className="detail__citation">« {h.commentaire} »</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
