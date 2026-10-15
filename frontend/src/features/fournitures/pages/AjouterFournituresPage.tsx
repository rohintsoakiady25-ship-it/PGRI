import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import { Champ, Section } from '@/components/demande/DemandePage';
import '@/components/liste/ListePage.css';
import { messageErreur } from '@/api/client';
import { normaliser } from '@/hooks/useListe';
import { quantiteAvecUnite, stockApi, UNITES, type ArticleStock, type Entree, type LigneEntree } from '../api';
import './DemandeFournituresPage.css';
import './AjouterFournituresPage.css';

interface Ligne {
  cle: number;
  designation: string;
  unite: string;
  categorie: string;
  quantite: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * Réception de fournitures au magasin (logistique, administrateur) : une ligne par article reçu.
 * Un article déjà au catalogue voit son stock augmenter ; une nouvelle désignation crée l'article.
 */
export default function AjouterFournituresPage() {
  const prochaine = useRef(1);
  const nouvelleLigne = (): Ligne => ({ cle: prochaine.current++, designation: '', unite: '', categorie: '', quantite: '' });
  const [lignes, setLignes] = useState<Ligne[]>(() => [nouvelleLigne()]);
  const [focusCle, setFocusCle] = useState<number | null>(null);
  const [fournisseur, setFournisseur] = useState('');
  const [observation, setObservation] = useState('');
  const [articles, setArticles] = useState<ArticleStock[]>([]);
  const [entrees, setEntrees] = useState<Entree[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(() => {
    stockApi.lister().then(setArticles).catch(() => setArticles([]));
    stockApi.entrees().then(setEntrees).catch(() => setEntrees([]));
  }, []);
  useEffect(charger, [charger]);

  const parDesignation = useMemo(() => new Map(articles.map((a) => [normaliser(a.designation), a])), [articles]);
  const trouver = (designation: string) => parDesignation.get(normaliser(designation.trim().replace(/\s+/g, ' ')));
  const categories = useMemo(
    () => [...new Set(articles.map((a) => a.categorie).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, 'fr')),
    [articles],
  );

  const maj = (cle: number, champ: keyof Omit<Ligne, 'cle'>, valeur: string) =>
    setLignes((l) => l.map((x) => (x.cle === cle ? { ...x, [champ]: valeur } : x)));

  function ajouter() {
    const l = nouvelleLigne();
    setLignes((ls) => [...ls, l]);
    setFocusCle(l.cle);
  }

  function retirer(cle: number) {
    setLignes((ls) => (ls.length > 1 ? ls.filter((x) => x.cle !== cle) : [nouvelleLigne()]));
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setSucces(null);
    const remplies = lignes.filter((l) => l.designation.trim() || l.quantite);
    if (!remplies.length) return setErreur('Ajoutez au moins un article reçu.');
    const envoyees: LigneEntree[] = [];
    for (const l of remplies) {
      const quantite = Number(l.quantite);
      if (!l.designation.trim()) return setErreur('Indiquez l’article de chaque ligne.');
      if (!Number.isInteger(quantite) || quantite < 1) return setErreur(`Quantité reçue invalide pour « ${l.designation.trim()} ».`);
      const article = trouver(l.designation);
      if (article) envoyees.push({ articleId: article.id, quantite });
      else if (!l.unite.trim()) return setErreur(`Indiquez l’unité du nouvel article « ${l.designation.trim()} ».`);
      else envoyees.push({ designation: l.designation, unite: l.unite, categorie: l.categorie.trim() || null, quantite });
    }
    setEnvoi(true);
    try {
      const misAJour = await stockApi.entrer(envoyees, fournisseur.trim() || null, observation.trim() || null);
      setSucces(
        `Entrée enregistrée : ${misAJour.length} article${misAJour.length > 1 ? 's' : ''} mis à jour (${misAJour
          .map((a) => `${a.designation} : ${quantiteAvecUnite(a.quantiteStock, a.unite)} en stock`)
          .join(' ; ')}).`,
      );
      setLignes([nouvelleLigne()]);
      setFournisseur('');
      setObservation('');
      charger();
    } catch (err) {
      setErreur(messageErreur(err, 'L’entrée en stock n’a pas pu être enregistrée.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <AppLayout>
      <div className="demande">
        <h1 className="demande__title">Ajouter des fournitures</h1>
        <p className="demande__intro">
          Enregistrez les fournitures reçues au magasin : une ligne par article. Un article déjà au catalogue voit son stock
          augmenter ; une nouvelle désignation crée l’article. Le stock se consulte dans{' '}
          <Link to="/fournitures/liste">Liste des fournitures</Link>.
        </p>
        {succes && (
          <p className="liste__bandeau" role="status">
            {succes}
          </p>
        )}

        <div className="demande__grid">
          <form className="demande__form" noValidate onSubmit={soumettre}>
            <Section titre="Articles reçus">
              <div className="champ champ--large">
                <datalist id="articles-catalogue">
                  {articles.map((a) => (
                    <option key={a.id} value={a.designation}>
                      {a.reference}
                    </option>
                  ))}
                </datalist>
                <datalist id="unites-stock">
                  {UNITES.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
                <datalist id="categories-stock">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <table className="lignes lignes--entree">
                  <thead>
                    <tr>
                      <th scope="col">Article</th>
                      <th scope="col" className="lignes__unite">Unité</th>
                      <th scope="col" className="lignes__categorie">Catégorie</th>
                      <th scope="col" className="lignes__qte">Qté reçue</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l, i) => {
                      const article = l.designation.trim() ? trouver(l.designation) : undefined;
                      const nouveau = Boolean(l.designation.trim()) && !article;
                      return (
                        <tr key={l.cle}>
                          <td data-label="Article">
                            <input
                              type="text"
                              list="articles-catalogue"
                              aria-label={`Article ${i + 1}`}
                              aria-describedby={`etat-ligne-${l.cle}`}
                              placeholder="Désignation"
                              maxLength={150}
                              value={l.designation}
                              autoFocus={focusCle === l.cle}
                              onChange={(e) => maj(l.cle, 'designation', e.target.value)}
                            />
                            <span id={`etat-ligne-${l.cle}`} className="lignes__etat">
                              {article
                                ? `${article.reference} · en stock : ${quantiteAvecUnite(article.quantiteStock, article.unite)}${article.actif ? '' : ' · retiré du catalogue, sera remis'}`
                                : nouveau
                                  ? 'Nouvel article : précisez l’unité'
                                  : ''}
                            </span>
                          </td>
                          <td data-label="Unité" className="lignes__unite">
                            <input
                              type="text"
                              list="unites-stock"
                              aria-label={`Unité de l’article ${i + 1}`}
                              placeholder="pièce"
                              maxLength={30}
                              value={article ? article.unite : l.unite}
                              readOnly={Boolean(article)}
                              onChange={(e) => maj(l.cle, 'unite', e.target.value)}
                            />
                          </td>
                          <td data-label="Catégorie" className="lignes__categorie">
                            <input
                              type="text"
                              list="categories-stock"
                              aria-label={`Catégorie de l’article ${i + 1}`}
                              placeholder={article ? '—' : 'Papeterie'}
                              maxLength={60}
                              value={article ? (article.categorie ?? '') : l.categorie}
                              readOnly={Boolean(article)}
                              onChange={(e) => maj(l.cle, 'categorie', e.target.value)}
                            />
                          </td>
                          <td data-label="Quantité reçue" className="lignes__qte">
                            <input
                              type="number"
                              aria-label={`Quantité reçue de l’article ${i + 1}`}
                              min={1}
                              step={1}
                              value={l.quantite}
                              onChange={(e) => maj(l.cle, 'quantite', e.target.value)}
                            />
                          </td>
                          <td className="lignes__action">
                            <button type="button" className="lignes__remove" onClick={() => retirer(l.cle)}
                              aria-label={`Retirer l’article ${i + 1}`} title="Retirer cette ligne">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
                                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div>
                  <button type="button" className="btn btn--ghost" onClick={ajouter}>
                    + Ajouter un article
                  </button>
                </div>
              </div>
            </Section>

            <Section titre="Livraison">
              <Champ id="fournisseur" label="Fournisseur" optionnel>
                <input id="fournisseur" maxLength={150} value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} />
              </Champ>
              <Champ id="observation" label="Observation" optionnel aide="Ex. numéro du bon de livraison.">
                <input id="observation" maxLength={255} value={observation} onChange={(e) => setObservation(e.target.value)} />
              </Champ>
            </Section>

            {erreur && (
              <p className="demande__erreur" role="alert">
                {erreur}
              </p>
            )}
            <div className="demande__actions">
              <button type="submit" className="btn btn--primary" disabled={envoi}>
                {envoi ? 'Enregistrement…' : 'Enregistrer l’entrée en stock'}
              </button>
            </div>
          </form>

          <aside className="circuit" aria-labelledby="entrees-titre">
            <h2 id="entrees-titre" className="circuit__title">
              Dernières entrées
            </h2>
            {entrees === null ? (
              <p className="circuit__note">Chargement…</p>
            ) : entrees.length === 0 ? (
              <p className="circuit__note">Aucune entrée enregistrée pour l’instant.</p>
            ) : (
              <ul className="entrees">
                {entrees.map((e) => (
                  <li key={e.id} className="entrees__ligne">
                    <span className="entrees__article">
                      +{quantiteAvecUnite(e.quantite, e.article.unite)} · {e.article.designation}
                    </span>
                    <span className="entrees__detail">
                      {formatDate(e.date)} · {e.auteur}
                      {e.observation && ` · ${e.observation}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
