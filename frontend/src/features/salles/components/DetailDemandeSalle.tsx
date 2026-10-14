import { useEffect, useState, type FormEvent } from 'react';
import Badge from '@/components/common/Badge';
import { messageErreur } from '@/api/client';
import { creneau, dateHeure, demandesSalleApi, LIBELLE_STATUT, TON_STATUT, type ChoixAppareil, type DetailDemandeSalle } from '../api';
import './DetailDemandeSalle.css';

interface Props {
  id: string;
  /** Après une action (décision, annulation, commentaire) : la liste se met à jour. */
  onModifiee: () => void;
}

/** Détail d'une réservation : informations, décision de la logistique, annulation, commentaires, historique. */
export default function DetailDemandeSalle({ id, onModifiee }: Props) {
  const [d, setD] = useState<DetailDemandeSalle | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [motif, setMotif] = useState('');
  const [texte, setTexte] = useState('');
  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false);

  // Choix de l'appareil par la logistique : matériel demandé → appareil sélectionné
  const [choixAppareils, setChoixAppareils] = useState<ChoixAppareil[]>([]);
  const [selection, setSelection] = useState<Record<string, string>>({});

  useEffect(() => {
    demandesSalleApi.detail(id).then(setD).catch((e) => setErreur(messageErreur(e, 'La réservation n’a pas pu être chargée.')));
  }, [id]);

  const peutDecider = Boolean(d?.actions.decider && d.equipementsSouhaites.length);
  useEffect(() => {
    if (!peutDecider) return;
    demandesSalleApi
      .appareils(id)
      .then((c) => {
        setChoixAppareils(c);
        setSelection(Object.fromEntries(c.map((x) => [x.nom, x.attribueId ?? x.options[0]?.id ?? ''])));
      })
      .catch(() => setChoixAppareils([]));
  }, [id, peutDecider]);
  const appareilIds = choixAppareils.length ? Object.values(selection).filter(Boolean) : undefined;

  async function agir(action: () => Promise<DetailDemandeSalle>, apres?: () => void) {
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

  function commenter(e: FormEvent) {
    e.preventDefault();
    if (texte.trim()) agir(() => demandesSalleApi.commenter(id, texte), () => setTexte(''));
  }

  if (!d) return <p className="detail__chargement">{erreur ?? 'Chargement…'}</p>;

  const liberer = d.statut === 'CONFIRMEE';
  return (
    <div className="detail">
      <div className="detail__entete">
        <span className="detail__reference">{d.reference}</span>
        <Badge ton={TON_STATUT[d.statut]}>{LIBELLE_STATUT[d.statut]}</Badge>
      </div>

      {erreur && (
        <p className="formulaire__erreur" role="alert">
          {erreur}
        </p>
      )}

      <dl className="detail__infos">
        <dt>Salle</dt>
        <dd>{d.salle.nom} ({d.salle.capacite} places)</dd>
        <dt>Créneau</dt>
        <dd>{creneau(d.creneauDebut, d.creneauFin)}</dd>
        <dt>Objet</dt>
        <dd>{d.objet}</dd>
        <dt>Participants</dt>
        <dd>
          {d.nbParticipants}
          {d.participants && <span className="detail__liste">{d.participants}</span>}
        </dd>
        {(d.equipementsAttribues.length > 0 || d.equipementsSouhaites.length > 0) && (
          <>
            <dt>Équipements</dt>
            <dd>
              {d.equipementsAttribues.length > 0
                ? d.equipementsAttribues.map((e) => `${e.nom} (${e.reference})`).join(', ')
                : d.equipementsSouhaites.join(', ')}
              {d.equipementsAttribues.length === 0 && d.statut === 'EN_ATTENTE_LOGISTIQUE' && (
                <span className="detail__discret"> · attribués à la confirmation</span>
              )}
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
        {d.soumisLe && (
          <>
            <dt>Envoyée le</dt>
            <dd>{dateHeure(d.soumisLe)}</dd>
          </>
        )}
      </dl>

      {d.actions.decider && (
        <section className="detail__bloc detail__bloc--decision" aria-labelledby="decision-titre">
          <h3 id="decision-titre" className="detail__titre">Votre décision</h3>
          {choixAppareils.length > 0 && (
            <fieldset className="detail__appareils">
              <legend className="detail__libelle">Matériel à attribuer</legend>
              {choixAppareils.map((c) => (
                <label key={c.nom} className="detail__appareil">
                  <span>{c.nom}</span>
                  {c.options.length === 0 ? (
                    <span className="detail__discret">Aucun appareil libre : tous sont attribués à des réservations confirmées</span>
                  ) : (
                    <select value={selection[c.nom] ?? ''} onChange={(e) => setSelection((s) => ({ ...s, [c.nom]: e.target.value }))}>
                      {c.options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.reference}
                          {o.partage ? ' (partagé)' : ''}
                          {o.description ? ` · ${o.description}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </label>
              ))}
            </fieldset>
          )}
          <label className="detail__libelle" htmlFor="motif">
            Commentaire <span className="formulaire__facultatif">(obligatoire pour un refus)</span>
          </label>
          <textarea id="motif" rows={2} maxLength={1000} value={motif} onChange={(e) => setMotif(e.target.value)} />
          <div className="detail__boutons">
            <button type="button" className="btn btn--secondary" disabled={envoi}
              onClick={() => agir(() => demandesSalleApi.decider(id, 'REFUSEE', motif.trim() || null), () => setMotif(''))}>
              Refuser
            </button>
            <button type="button" className="btn btn--primary" disabled={envoi}
              onClick={() => agir(() => demandesSalleApi.decider(id, 'VALIDEE', motif.trim() || null, appareilIds), () => setMotif(''))}>
              Confirmer la réservation
            </button>
          </div>
        </section>
      )}

      {d.actions.annuler && (
        <div className="detail__annulation">
          {confirmerAnnulation ? (
            <>
              <span>{liberer ? 'Libérer la salle pour d’autres réunions ?' : 'Annuler cette demande ?'}</span>
              <button type="button" className="btn btn--petit" onClick={() => setConfirmerAnnulation(false)}>
                Non
              </button>
              <button type="button" className="btn btn--petit btn--petit-danger" disabled={envoi}
                onClick={() => agir(() => demandesSalleApi.annuler(id), () => setConfirmerAnnulation(false))}>
                Oui, {liberer ? 'libérer' : 'annuler'}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--petit btn--petit-danger" onClick={() => setConfirmerAnnulation(true)}>
              {liberer ? 'Libérer la salle' : 'Annuler la demande'}
            </button>
          )}
        </div>
      )}

      <section className="detail__bloc" aria-labelledby="commentaires-titre">
        <h3 id="commentaires-titre" className="detail__titre">
          Commentaires {d.commentaires.length > 0 && <span className="detail__discret">({d.commentaires.length})</span>}
        </h3>
        {d.commentaires.length === 0 ? (
          <p className="detail__discret">Aucun commentaire. Le N+1 et l’assistante de direction peuvent donner leur avis ici.</p>
        ) : (
          <ul className="detail__commentaires">
            {d.commentaires.map((c) => (
              <li key={c.id}>
                <span className="detail__auteur">
                  {c.auteur?.nomComplet ?? '—'} <span className="detail__discret">· {dateHeure(c.date)}</span>
                </span>
                <p>{c.texte}</p>
              </li>
            ))}
          </ul>
        )}
        <form className="detail__commenter" onSubmit={commenter}>
          <label className="sr-only" htmlFor="commentaire">Ajouter un commentaire</label>
          <textarea id="commentaire" rows={2} maxLength={1000} placeholder="Ajouter un commentaire…" value={texte}
            onChange={(e) => setTexte(e.target.value)} />
          <button type="submit" className="btn btn--secondary" disabled={envoi || !texte.trim()}>
            Commenter
          </button>
        </form>
      </section>

      <section className="detail__bloc" aria-labelledby="historique-titre">
        <h3 id="historique-titre" className="detail__titre">Historique</h3>
        <ol className="detail__historique">
          {d.historique.map((h, i) => (
            <li key={i}>
              <span className="detail__discret">{dateHeure(h.date)}</span>{' '}
              <strong>{LIBELLE_STATUT[h.nouveauStatut] ?? h.nouveauStatut}</strong>
              {h.auteur ? ` par ${h.auteur.nomComplet}` : ' (automatique)'}
              {h.commentaire && <span className="detail__citation">« {h.commentaire} »</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
