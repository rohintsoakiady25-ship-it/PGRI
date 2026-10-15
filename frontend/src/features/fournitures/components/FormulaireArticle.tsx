import { useState, type FormEvent } from 'react';
import { messageErreur } from '@/api/client';
import { quantiteAvecUnite, stockApi, UNITES, type ArticleSaisie, type ArticleStock } from '../api';

interface Props {
  article: ArticleStock;
  categories: string[];
  onEnregistre: (a: ArticleStock) => void;
  onAnnuler: () => void;
}

/**
 * Modification d'une fiche article (logistique, administrateur).
 * Le stock ne se modifie pas ici, sauf correction après inventaire (ajustement tracé).
 */
export default function FormulaireArticle({ article, categories, onEnregistre, onAnnuler }: Props) {
  const [designation, setDesignation] = useState(article.designation);
  const [unite, setUnite] = useState(article.unite);
  const [categorie, setCategorie] = useState(article.categorie ?? '');
  const [seuil, setSeuil] = useState(String(article.seuilAlerte));
  const [fournisseur, setFournisseur] = useState(article.fournisseur ?? '');
  const [actif, setActif] = useState(article.actif);
  const [stockCompte, setStockCompte] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    const seuilAlerte = Number(seuil);
    if (!Number.isInteger(seuilAlerte) || seuilAlerte < 0) return setErreur('Le seuil d’alerte doit être un nombre entier positif ou nul.');
    let compte: number | undefined;
    if (stockCompte.trim()) {
      compte = Number(stockCompte);
      if (!Number.isInteger(compte) || compte < 0) return setErreur('Le stock compté doit être un nombre entier positif ou nul.');
    }
    const saisie: ArticleSaisie = {
      designation, unite, categorie: categorie.trim() || null, seuilAlerte, fournisseur: fournisseur.trim() || null, actif, stockCompte: compte,
    };
    setEnvoi(true);
    try {
      onEnregistre(await stockApi.modifier(article.id, saisie));
    } catch (err) {
      setErreur(messageErreur(err, "L'article n'a pas pu être enregistré."));
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
      <datalist id="art-unites">
        {UNITES.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <datalist id="art-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="formulaire__champ formulaire__champ--large">
        <label htmlFor="art-designation">Désignation</label>
        <input id="art-designation" required autoFocus maxLength={150} value={designation} onChange={(e) => setDesignation(e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="art-unite">Unité</label>
        <input id="art-unite" required list="art-unites" maxLength={30} value={unite} onChange={(e) => setUnite(e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="art-categorie">
          Catégorie <span className="formulaire__facultatif">(facultatif)</span>
        </label>
        <input id="art-categorie" list="art-categories" maxLength={60} placeholder="Ex. Papeterie" value={categorie}
          onChange={(e) => setCategorie(e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="art-seuil">Seuil d’alerte</label>
        <input id="art-seuil" type="number" min={0} step={1} value={seuil} onChange={(e) => setSeuil(e.target.value)}
          aria-describedby="art-seuil-aide" />
        <span id="art-seuil-aide" className="formulaire__facultatif">« Stock bas » à ce niveau ou en dessous.</span>
      </div>
      <div className="formulaire__champ">
        <label htmlFor="art-fournisseur">
          Fournisseur <span className="formulaire__facultatif">(facultatif)</span>
        </label>
        <input id="art-fournisseur" maxLength={150} value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} />
      </div>
      <div className="formulaire__champ">
        <label htmlFor="art-compte">
          Stock compté <span className="formulaire__facultatif">(inventaire, facultatif)</span>
        </label>
        <input id="art-compte" type="number" min={0} step={1} placeholder={String(article.quantiteStock)} value={stockCompte}
          onChange={(e) => setStockCompte(e.target.value)} aria-describedby="art-compte-aide" />
        <span id="art-compte-aide" className="formulaire__facultatif">
          En stock : {quantiteAvecUnite(article.quantiteStock, article.unite)}. Un écart est enregistré comme ajustement.
        </span>
      </div>
      <div className="formulaire__champ">
        <span className="formulaire__libelle">Catalogue</span>
        <label className="formulaire__case">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
          Proposé aux demandeurs
        </label>
      </div>
      <div className="formulaire__actions">
        <button type="button" className="btn btn--secondary" onClick={onAnnuler}>
          Annuler
        </button>
        <button type="submit" className="btn btn--primary" disabled={envoi}>
          {envoi ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
