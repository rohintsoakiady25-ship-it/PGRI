import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ListePage from '@/components/liste/ListePage';
import Badge from '@/components/common/Badge';
import Modale from '@/components/common/Modale';
import ConfirmerSuppression from '@/components/common/ConfirmerSuppression';
import { normaliser, useListe } from '@/hooks/useListe';
import { ETAT_STOCK, quantiteAvecUnite, stockApi, type ArticleStock } from '../api';
import FormulaireArticle from '../components/FormulaireArticle';

/** Catalogue du magasin et niveau de stock de chaque article (logistique, administrateur). */
export default function ListeFournituresPage() {
  const { elements, chargement, erreur, recharger } = useListe(stockApi.lister);
  const [recherche, setRecherche] = useState('');
  const [categorie, setCategorie] = useState('');
  const [etat, setEtat] = useState('');
  const [edition, setEdition] = useState<ArticleStock | null>(null);
  const [aSupprimer, setASupprimer] = useState<ArticleStock | null>(null);

  const categories = useMemo(
    () => [...new Set(elements.map((a) => a.categorie).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, 'fr')),
    [elements],
  );

  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return elements.filter(
      (a) =>
        (!q || normaliser(`${a.reference} ${a.designation} ${a.fournisseur ?? ''}`).includes(q)) &&
        (!categorie || (categorie === '-' ? !a.categorie : a.categorie === categorie)) &&
        (!etat || (etat === 'RETIRE' ? !a.actif : a.actif && a.etat === etat)),
    );
  }, [elements, recherche, categorie, etat]);

  return (
    <>
      <ListePage
        titre="Liste des fournitures"
        intro="Articles du catalogue du magasin et leur stock. Le stock augmente avec les réceptions (« Ajouter des fournitures ») et diminue à la remise des demandes ; un article est signalé « Stock bas » quand il atteint son seuil d’alerte."
        placeholderRecherche="Rechercher par référence, désignation ou fournisseur"
        recherche={recherche}
        onRecherche={setRecherche}
        filtres={[
          { id: 'categorie', label: 'Catégorie', valeur: categorie, onChange: setCategorie,
            options: [...categories.map((c) => ({ valeur: c, libelle: c })), { valeur: '-', libelle: 'Sans catégorie' }] },
          { id: 'etat', label: 'État', valeur: etat, onChange: setEtat,
            options: [
              { valeur: 'OK', libelle: 'Disponible' },
              { valeur: 'BAS', libelle: 'Stock bas' },
              { valeur: 'RUPTURE', libelle: 'Rupture' },
              { valeur: 'RETIRE', libelle: 'Retiré du catalogue' },
            ] },
        ]}
        colonnes={[
          { label: 'Référence' }, { label: 'Article' }, { label: 'Catégorie' }, { label: 'En stock', numerique: true },
          { label: 'Seuil', numerique: true }, { label: 'État' }, { label: 'Actions', sr: true },
        ]}
        lignes={visibles.map((a) => ({
          cle: a.id,
          attenuee: !a.actif,
          cellules: [
            <strong key="r">{a.reference}</strong>,
            <span key="d">
              {a.designation}
              {a.fournisseur && <span className="liste__discret"> · {a.fournisseur}</span>}
            </span>,
            a.categorie ?? '—',
            quantiteAvecUnite(a.quantiteStock, a.unite),
            a.seuilAlerte.toLocaleString('fr-FR'),
            a.actif ? (
              <Badge key="e" ton={ETAT_STOCK[a.etat].ton}>{ETAT_STOCK[a.etat].libelle}</Badge>
            ) : (
              <Badge key="e" ton="neutre">Retiré du catalogue</Badge>
            ),
            <span key="a" className="liste__actions-ligne">
              <button type="button" className="btn btn--petit" onClick={() => setEdition(a)} aria-label={`Modifier l’article ${a.designation}`}>
                Modifier
              </button>
              <button type="button" className="btn btn--petit btn--petit-danger" onClick={() => setASupprimer(a)}
                aria-label={`Supprimer l’article ${a.designation}`}>
                Supprimer
              </button>
            </span>,
          ],
        }))}
        chargement={chargement}
        erreur={erreur}
        total={elements.length}
        messageVide="Aucune fourniture au catalogue. Enregistrez une réception avec « Ajouter des fournitures »."
        action={
          <Link to="/fournitures/ajouter" className="btn btn--primary">
            + Ajouter des fournitures
          </Link>
        }
      />
      <Modale ouverte={edition !== null} titre={`Modifier ${edition ? `${edition.designation} (${edition.reference})` : ''}`}
        onFermer={() => setEdition(null)}>
        {edition && (
          <FormulaireArticle
            article={edition}
            categories={categories}
            onAnnuler={() => setEdition(null)}
            onEnregistre={() => {
              setEdition(null);
              recharger();
            }}
          />
        )}
      </Modale>
      <Modale ouverte={aSupprimer !== null} titre="Supprimer l’article ?" onFermer={() => setASupprimer(null)}>
        {aSupprimer && (
          <ConfirmerSuppression
            nom={`${aSupprimer.designation} (${aSupprimer.reference})`}
            conseil="décochez « Proposé aux demandeurs »"
            supprimer={() => stockApi.supprimer(aSupprimer.id)}
            onAnnuler={() => setASupprimer(null)}
            onSupprime={() => {
              setASupprimer(null);
              recharger();
            }}
          />
        )}
      </Modale>
    </>
  );
}
