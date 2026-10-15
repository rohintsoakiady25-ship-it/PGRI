import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ListePage from '@/components/liste/ListePage';
import Badge from '@/components/common/Badge';
import Modale from '@/components/common/Modale';
import { normaliser, useListe } from '@/hooks/useListe';
import { creneau, demandesSalleApi, LIBELLE_STATUT, TON_STATUT, type StatutSalle } from '@/features/salles/api';
import DetailDemandeSalle from '@/features/salles/components/DetailDemandeSalle';

/** Mes demandes en cours et passées. Pour l'instant : les réservations de salle. */
export default function MesDemandesPage() {
  const message = (useLocation().state as { message?: string } | null)?.message;
  const { elements, chargement, erreur, recharger } = useListe(demandesSalleApi.mes);
  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState('');
  const [ouverte, setOuverte] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return elements.filter(
      (d) => (!q || normaliser(`${d.reference} ${d.objet} ${d.salle.nom}`).includes(q)) && (!statut || d.statut === statut),
    );
  }, [elements, recherche, statut]);

  return (
    <>
      <ListePage
        titre="Mes demandes"
        bandeau={message}
        placeholderRecherche="Rechercher par référence, objet ou salle"
        recherche={recherche}
        onRecherche={setRecherche}
        filtres={[
          { id: 'statut', label: 'Statut', valeur: statut, onChange: setStatut,
            options: (Object.keys(LIBELLE_STATUT) as StatutSalle[]).map((k) => ({ valeur: k, libelle: LIBELLE_STATUT[k] })) },
        ]}
        colonnes={[{ label: 'Référence' }, { label: 'Salle' }, { label: 'Créneau' }, { label: 'Objet' }, { label: 'Statut' }, { label: 'Actions', sr: true }]}
        lignes={visibles.map((d) => ({
          cle: d.id,
          attenuee: ['ANNULEE', 'LIBEREE', 'TERMINEE'].includes(d.statut),
          cellules: [
            <strong key="r">{d.reference}</strong>,
            d.salle.nom,
            creneau(d.creneauDebut, d.creneauFin),
            d.objet,
            <Badge key="s" ton={TON_STATUT[d.statut]}>{LIBELLE_STATUT[d.statut]}</Badge>,
            <span key="a" className="liste__actions-ligne">
              {d.nbCommentaires > 0 && (
                <span className="liste__discret">
                  {d.nbCommentaires} commentaire{d.nbCommentaires > 1 ? 's' : ''}
                </span>
              )}
              <button type="button" className="btn btn--petit" onClick={() => setOuverte(d.id)} aria-label={`Voir la demande ${d.reference}`}>
                Voir
              </button>
            </span>,
          ],
        }))}
        chargement={chargement}
        erreur={erreur}
        total={elements.length}
        messageVide="Vous n’avez encore fait aucune demande."
        action={
          <Link to="/demandes/salle" className="btn btn--primary">
            + Réserver une salle
          </Link>
        }
      />
      <Modale ouverte={ouverte !== null} titre="Réservation de salle" onFermer={() => setOuverte(null)} large>
        {ouverte && <DetailDemandeSalle id={ouverte} onModifiee={recharger} />}
      </Modale>
    </>
  );
}
