import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '@/components/common/Badge';
import { messageErreur } from '@/api/client';
import { dateHeure } from '@/features/salles/api';
import '@/features/salles/components/DetailDemandeSalle.css';
import {
  demandesFournitureApi, LIBELLE_STATUT_FOURNITURE, quantiteAvecUnite, TON_STATUT_FOURNITURE, type DetailDemandeFourniture,
} from '../api';
import RemiseFournitures from './RemiseFournitures';
import './DetailDemandeFourniture.css';

interface Props {
  id: string;
  /** Après une action (décision, annulation) : la liste se met à jour. */
  onModifiee: () => void;
}

const jour = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** Détail d'une demande de fournitures : articles, quantités demandées et remises, décisions, annulation, historique. */
export default function DetailDemandeFourniture({ id, onModifiee }: Props) {
  const [d, setD] = useState<DetailDemandeFourniture | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false);
  const [commentaire, setCommentaire] = useState('');

  useEffect(() => {
    demandesFournitureApi.detail(id).then(setD).catch((e) => setErreur(messageErreur(e, 'La demande n’a pas pu être chargée.')));
  }, [id]);

  async function agir(action: () => Promise<DetailDemandeFourniture>, apres?: () => void) {
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
    if (decision === 'REFUSEE' && !commentaire.trim()) {
      setErreur('Indiquez le motif du refus : il sera communiqué au demandeur.');
      return;
    }
    const texte = commentaire.trim() || null;
    agir(
      () => (d!.actions.deciderN1 ? demandesFournitureApi.deciderN1(id, decision, texte) : demandesFournitureApi.deciderLogistique(id, decision, texte)),
      () => setCommentaire(''),
    );
  }

  if (!d) return <p className="detail__chargement">{erreur ?? 'Chargement…'}</p>;
  const remise = d.lignes.some((l) => l.quantiteLivree !== null);
  // Le stock n'est utile qu'avant la remise ; pendant la remise, il est dans le tableau du magasin
  const stock = d.lignes.some((l) => l.enStock !== null) && !remise && !d.actions.remettre;

  return (
    <div className="detail">
      <div className="detail__entete">
        <span className="detail__reference">{d.reference}</span>
        <Badge ton={TON_STATUT_FOURNITURE[d.statut]}>{LIBELLE_STATUT_FOURNITURE[d.statut]}</Badge>
        {d.actions.bonDeSortie && (
          <Link to={`/fournitures/bons/${d.id}`} className="btn btn--primary detail__bon">
            Bon de sortie
          </Link>
        )}
      </div>

      {erreur && (
        <p className="formulaire__erreur" role="alert">
          {erreur}
        </p>
      )}

      <table className="articles">
        <thead>
          <tr>
            <th scope="col">Article</th>
            <th scope="col" className="articles__num">Demandé</th>
            {remise && <th scope="col" className="articles__num">Remis</th>}
            {stock && <th scope="col" className="articles__num">En stock</th>}
            <th scope="col">Observations</th>
          </tr>
        </thead>
        <tbody>
          {d.lignes.map((l) => (
            <tr key={l.id}>
              <td>
                {l.article.designation}
                <span className="detail__discret"> · {l.article.reference}</span>
              </td>
              <td className="articles__num">{quantiteAvecUnite(l.quantiteDemandee, l.article.unite)}</td>
              {remise && (
                <td className="articles__num">{l.quantiteLivree === null ? '—' : quantiteAvecUnite(l.quantiteLivree, l.article.unite)}</td>
              )}
              {stock && (
                <td className={`articles__num${(l.enStock ?? 0) < l.quantiteDemandee ? ' articles__manque' : ''}`}
                  title={(l.enStock ?? 0) < l.quantiteDemandee ? 'Stock insuffisant pour servir toute la quantité' : undefined}>
                  {quantiteAvecUnite(l.enStock ?? 0, l.article.unite)}
                </td>
              )}
              <td>{l.observations ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="detail__infos">
        {d.dateBesoin && (
          <>
            <dt>Besoin pour le</dt>
            <dd>{jour(d.dateBesoin)}</dd>
          </>
        )}
        {d.observations && (
          <>
            <dt>Observations</dt>
            <dd>
              <span className="detail__liste">{d.observations}</span>
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

      {(d.actions.deciderN1 || d.actions.deciderLogistique) && (
        <section className="detail__bloc detail__bloc--decision" aria-labelledby="decision-titre">
          <h3 id="decision-titre" className="detail__titre">
            Votre décision ({d.actions.deciderN1 ? 'supérieur direct' : 'responsable logistique'})
          </h3>
          <p className="detail__discret">
            {d.actions.deciderN1
              ? 'Validée, la demande part au responsable logistique.'
              : 'Validée, la demande part au magasin : le magasinier la prépare et la remet.'}
          </p>
          <label className="detail__libelle" htmlFor="commentaire-decision">
            Commentaire <span className="formulaire__facultatif">(obligatoire pour un refus)</span>
          </label>
          <textarea id="commentaire-decision" rows={2} maxLength={1000} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
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

      {d.actions.remettre && (
        <RemiseFournitures
          demande={d}
          envoi={envoi}
          onPrendreEnCharge={() => agir(() => demandesFournitureApi.prendreEnCharge(id))}
          onRemettre={(lignes) => agir(() => demandesFournitureApi.remettre(id, lignes))}
        />
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
                onClick={() => agir(() => demandesFournitureApi.annuler(id), () => setConfirmerAnnulation(false))}>
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
              <strong>{LIBELLE_STATUT_FOURNITURE[h.nouveauStatut] ?? h.nouveauStatut}</strong>
              {h.auteur ? ` par ${h.auteur.nomComplet}` : ' (automatique)'}
              {h.commentaire && <span className="detail__citation">« {h.commentaire} »</span>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
