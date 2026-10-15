import { useMemo, useState } from 'react';
import ListePage from '@/components/liste/ListePage';
import Badge from '@/components/common/Badge';
import Modale from '@/components/common/Modale';
import { useAuth } from '@/auth/AuthContext';
import { peutGererReferentiels } from '@/auth/droits';
import { normaliser, useListe } from '@/hooks/useListe';
import { creneau, demandesSalleApi, LIBELLE_STATUT, TON_STATUT, type StatutSalle } from '../api';
import DetailDemandeSalle from '../components/DetailDemandeSalle';

/**
 * Demandes de salle à suivre : le responsable logistique les valide ou les refuse ;
 * le N+1 et l'assistante de direction les consultent et les commentent.
 */
export default function SuiviDemandesSallePage() {
  const { utilisateur } = useAuth();
  const logistique = peutGererReferentiels(utilisateur);
  const { elements, chargement, erreur, recharger } = useListe(demandesSalleApi.aSuivre);
  const [recherche, setRecherche] = useState('');
  // La logistique arrive directement sur ce qu'elle a à traiter
  const [statut, setStatut] = useState(logistique ? 'EN_ATTENTE_LOGISTIQUE' : '');
  const [ouverte, setOuverte] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return elements.filter(
      (d) =>
        (!q || normaliser(`${d.reference} ${d.objet} ${d.salle.nom} ${d.demandeur.nomComplet}`).includes(q)) &&
        (!statut || d.statut === statut),
    );
  }, [elements, recherche, statut]);
  const enAttente = elements.filter((d) => d.statut === 'EN_ATTENTE_LOGISTIQUE').length;

  return (
    <>
      <ListePage
        titre="Demandes de salle"
        placeholderRecherche="Rechercher par référence, objet, salle ou demandeur"
        recherche={recherche}
        onRecherche={setRecherche}
        filtres={[
          { id: 'statut', label: 'Statut', valeur: statut, onChange: setStatut,
            options: (Object.keys(LIBELLE_STATUT) as StatutSalle[]).map((k) => ({ valeur: k, libelle: LIBELLE_STATUT[k] })) },
        ]}
        colonnes={[
          { label: 'Référence' }, { label: 'Demandeur' }, { label: 'Salle' }, { label: 'Créneau' }, { label: 'Objet' },
          { label: 'Statut' }, { label: 'Actions', sr: true },
        ]}
        lignes={visibles.map((d) => ({
          cle: d.id,
          attenuee: ['ANNULEE', 'LIBEREE', 'TERMINEE'].includes(d.statut),
          cellules: [
            <strong key="r">{d.reference}</strong>,
            <span key="d">
              {d.demandeur.nomComplet}
              {d.demandeur.direction && <span className="liste__discret"> · {d.demandeur.direction}</span>}
            </span>,
            `${d.salle.nom} · ${d.nbParticipants} pers.`,
            creneau(d.creneauDebut, d.creneauFin),
            d.objet,
            <Badge key="s" ton={TON_STATUT[d.statut]}>{LIBELLE_STATUT[d.statut]}</Badge>,
            <span key="a" className="liste__actions-ligne">
              {d.nbCommentaires > 0 && (
                <span className="liste__discret">
                  {d.nbCommentaires} commentaire{d.nbCommentaires > 1 ? 's' : ''}
                </span>
              )}
              <button
                type="button"
                className={`btn btn--petit${d.actions.decider ? ' btn--petit-accent' : ''}`}
                onClick={() => setOuverte(d.id)}
                aria-label={`${d.actions.decider ? 'Examiner' : 'Voir'} la demande ${d.reference}`}
              >
                {d.actions.decider ? 'Examiner' : 'Voir'}
              </button>
            </span>,
          ],
        }))}
        chargement={chargement}
        erreur={erreur}
        total={elements.length}
        messageVide={logistique ? 'Aucune réservation de salle pour le moment.' : 'Aucune réservation de vos collaborateurs pour le moment.'}
      />
      <Modale ouverte={ouverte !== null} titre="Réservation de salle" onFermer={() => setOuverte(null)} large>
        {ouverte && <DetailDemandeSalle id={ouverte} onModifiee={recharger} />}
      </Modale>
    </>
  );
}
