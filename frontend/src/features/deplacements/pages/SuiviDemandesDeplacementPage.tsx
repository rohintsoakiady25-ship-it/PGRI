import { useMemo, useState } from 'react';
import ListePage from '@/components/liste/ListePage';
import Badge from '@/components/common/Badge';
import Modale from '@/components/common/Modale';
import { useAuth } from '@/auth/AuthContext';
import { peutGererReferentiels } from '@/auth/droits';
import { normaliser, useListe } from '@/hooks/useListe';
import {
  demandesDeplacementApi, LIBELLE_STATUT_DEPLACEMENT, LIBELLE_TYPE, periode, TON_STATUT_DEPLACEMENT, type StatutDeplacement,
} from '../api';
import DetailDemandeDeplacement from '../components/DetailDemandeDeplacement';

/**
 * Demandes de déplacement à suivre : le N+1 valide ou refuse celles de ses collaborateurs ;
 * l'assistante de direction consulte celles de sa direction ; la logistique les voit toutes.
 */
export default function SuiviDemandesDeplacementPage() {
  const { utilisateur } = useAuth();
  const logistique = peutGererReferentiels(utilisateur);
  const { elements, chargement, erreur, recharger } = useListe(demandesDeplacementApi.aSuivre);
  const [recherche, setRecherche] = useState('');
  // Chacun arrive directement sur ce qu'il a à valider
  const [statut, setStatut] = useState(logistique ? 'EN_ATTENTE_LOGISTIQUE' : 'EN_ATTENTE_N1');
  const [ouverte, setOuverte] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return elements.filter(
      (d) =>
        (!q || normaliser(`${d.reference} ${d.motif} ${d.lieuDepart} ${d.destination} ${d.demandeur.nomComplet}`).includes(q)) &&
        (!statut || d.statut === statut),
    );
  }, [elements, recherche, statut]);
  const aDecider = (d: (typeof elements)[number]) => d.actions.deciderN1 || d.actions.deciderLogistique;
  const aValider = elements.filter(aDecider).length;

  return (
    <>
      <ListePage
        titre="Demandes à valider"
        bandeau={!chargement && aValider > 0 ? `${aValider} demande${aValider > 1 ? 's' : ''} attend${aValider > 1 ? 'ent' : ''} votre validation.` : undefined}
        placeholderRecherche="Rechercher par référence, motif, lieu ou demandeur"
        recherche={recherche}
        onRecherche={setRecherche}
        filtres={[
          { id: 'statut', label: 'Statut', valeur: statut, onChange: setStatut,
            options: (Object.keys(LIBELLE_STATUT_DEPLACEMENT) as StatutDeplacement[]).map((k) => ({ valeur: k, libelle: LIBELLE_STATUT_DEPLACEMENT[k] })) },
        ]}
        colonnes={[
          { label: 'Référence' }, { label: 'Demandeur' }, { label: 'Trajet' }, { label: 'Dates' }, { label: 'Véhicule' }, { label: 'Statut' },
          { label: 'Actions', sr: true },
        ]}
        lignes={visibles.map((d) => ({
          cle: d.id,
          attenuee: ['ANNULEE', 'REFUSEE', 'TERMINEE'].includes(d.statut),
          cellules: [
            <strong key="r">{d.reference}</strong>,
            <span key="p" className="liste__empile">
              {d.demandeur.nomComplet}
              {d.demandeur.service && <span className="liste__discret">{d.demandeur.service}</span>}
            </span>,
            <span key="t" className="liste__empile">
              {d.lieuDepart} → {d.destination}
              <span className="liste__discret">{LIBELLE_TYPE[d.typeDeplacement]} · {d.motif}</span>
            </span>,
            periode(d.dateHeureDepart, d.dateHeureRetourPrevue),
            d.affectation ? (
              <span key="v" className="liste__empile">
                {d.affectation.vehicule.immatriculation}
                <span className="liste__discret">{d.affectation.chauffeur.nomComplet}</span>
              </span>
            ) : (
              '—'
            ),
            <Badge key="s" ton={TON_STATUT_DEPLACEMENT[d.statut]}>{LIBELLE_STATUT_DEPLACEMENT[d.statut]}</Badge>,
            <span key="a" className="liste__actions-ligne">
              <button type="button" className={`btn btn--petit${aDecider(d) ? ' btn--petit-accent' : ''}`} onClick={() => setOuverte(d.id)}
                aria-label={`${aDecider(d) ? 'Examiner' : 'Voir'} la demande ${d.reference}`}>
                {aDecider(d) ? 'Examiner' : 'Voir'}
              </button>
            </span>,
          ],
        }))}
        chargement={chargement}
        erreur={erreur}
        total={elements.length}
        messageVide="Aucune demande de déplacement à suivre pour le moment."
      />
      <Modale ouverte={ouverte !== null} titre="Demande de déplacement" onFermer={() => setOuverte(null)} large>
        {ouverte && <DetailDemandeDeplacement id={ouverte} onModifiee={recharger} />}
      </Modale>
    </>
  );
}
