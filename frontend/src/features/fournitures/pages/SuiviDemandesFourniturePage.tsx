import { useMemo, useState } from 'react';
import ListePage from '@/components/liste/ListePage';
import Badge from '@/components/common/Badge';
import Modale from '@/components/common/Modale';
import { useAuth } from '@/auth/AuthContext';
import { aUnRole, peutGererReferentiels } from '@/auth/droits';
import { normaliser, useListe } from '@/hooks/useListe';
import {
  demandesFournitureApi, LIBELLE_STATUT_FOURNITURE, resumeArticles, TON_STATUT_FOURNITURE, type StatutFourniture,
} from '../api';
import DetailDemandeFourniture from '../components/DetailDemandeFourniture';

const jour = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Demandes de fournitures à suivre : le N+1 valide celles de ses collaborateurs, la logistique les valide
 * avant le magasin, l'assistante de direction consulte celles de sa direction, le magasinier voit les demandes validées.
 */
export default function SuiviDemandesFourniturePage() {
  const { utilisateur } = useAuth();
  const logistique = peutGererReferentiels(utilisateur);
  const magasinier = aUnRole(utilisateur, 'MAGASINIER');
  const { elements, chargement, erreur, recharger } = useListe(demandesFournitureApi.aSuivre);
  const [recherche, setRecherche] = useState('');
  // Chacun arrive directement sur ce qu'il a à traiter
  const [statut, setStatut] = useState(logistique ? 'EN_ATTENTE_LOGISTIQUE' : magasinier ? 'VALIDEE' : 'EN_ATTENTE_N1');
  const [ouverte, setOuverte] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return elements.filter(
      (d) =>
        (!q || normaliser(`${d.reference} ${resumeArticles(d)} ${d.observations ?? ''} ${d.demandeur.nomComplet}`).includes(q)) &&
        (!statut || d.statut === statut),
    );
  }, [elements, recherche, statut]);
  const aDecider = (d: (typeof elements)[number]) => d.actions.deciderN1 || d.actions.deciderLogistique || d.actions.remettre;
  const aValider = elements.filter(aDecider).length;

  return (
    <>
      <ListePage
        titre="Demandes de fournitures"
        bandeau={!chargement && aValider > 0 ? `${aValider} demande${aValider > 1 ? 's' : ''} à traiter.` : undefined}
        placeholderRecherche="Rechercher par référence, article ou demandeur"
        recherche={recherche}
        onRecherche={setRecherche}
        filtres={[
          { id: 'statut', label: 'Statut', valeur: statut, onChange: setStatut,
            options: (Object.keys(LIBELLE_STATUT_FOURNITURE) as StatutFourniture[]).map((k) => ({ valeur: k, libelle: LIBELLE_STATUT_FOURNITURE[k] })) },
        ]}
        colonnes={[{ label: 'Référence' }, { label: 'Demandeur' }, { label: 'Articles' }, { label: 'Besoin' }, { label: 'Statut' }, { label: 'Actions', sr: true }]}
        lignes={visibles.map((d) => ({
          cle: d.id,
          attenuee: ['ANNULEE', 'REFUSEE', 'REMISE'].includes(d.statut),
          cellules: [
            <strong key="r">{d.reference}</strong>,
            <span key="p" className="liste__empile">
              {d.demandeur.nomComplet}
              {d.demandeur.service && <span className="liste__discret">{d.demandeur.service}</span>}
            </span>,
            resumeArticles(d),
            d.dateBesoin ? jour(d.dateBesoin) : '—',
            <Badge key="s" ton={TON_STATUT_FOURNITURE[d.statut]}>{LIBELLE_STATUT_FOURNITURE[d.statut]}</Badge>,
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
        messageVide="Aucune demande de fournitures à suivre pour le moment."
      />
      <Modale ouverte={ouverte !== null} titre="Demande de fournitures" onFermer={() => setOuverte(null)} large>
        {ouverte && <DetailDemandeFourniture id={ouverte} onModifiee={recharger} />}
      </Modale>
    </>
  );
}
