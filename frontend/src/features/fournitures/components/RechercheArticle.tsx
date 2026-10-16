import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { IconRecherche } from '@/components/common/icons';
import { normaliser } from '@/hooks/useListe';
import type { ArticleCatalogue } from '../api';
import './RechercheArticle.css';

interface Props {
  catalogue: ArticleCatalogue[] | null;
  /** Article choisi ('' : aucun). */
  articleId: string;
  onChoisir: (id: string) => void;
  ariaLabel: string;
  autoFocus?: boolean;
}

const MAX_RESULTATS = 30;

/**
 * Choix d'un article du catalogue par saisie (combobox ARIA) : la liste se filtre au fil de la frappe
 * sur la désignation, la référence ou la catégorie ; flèches + Entrée pour choisir, Échap pour fermer,
 * Tab complète quand il ne reste qu'un article possible.
 */
export default function RechercheArticle({ catalogue, articleId, onChoisir, ariaLabel, autoFocus }: Props) {
  const choisi = catalogue?.find((a) => a.id === articleId);
  const [texte, setTexte] = useState(choisi?.designation ?? '');
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const idListe = useId();
  const liste = useRef<HTMLUListElement>(null);
  // Choix fait juste avant la perte du focus (Tab) : quitter() ne doit pas l'écraser avec un état périmé
  const vientDeChoisir = useRef(false);

  // Article choisi ou catalogue chargé après coup : le champ affiche la désignation
  useEffect(() => {
    if (choisi) setTexte(choisi.designation);
  }, [choisi]);

  const resultats = useMemo(() => {
    const q = normaliser(texte.trim());
    const tous = catalogue ?? [];
    // Champ qui montre l'article déjà choisi : on propose tout le catalogue
    const filtres = !q || (choisi && texte === choisi.designation)
      ? tous
      : tous.filter((a) => normaliser(`${a.designation} ${a.reference} ${a.categorie ?? ''}`).includes(q));
    return filtres.slice(0, MAX_RESULTATS);
  }, [catalogue, texte, choisi]);

  useEffect(() => {
    liste.current?.querySelector(`[data-index="${actif}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [actif]);

  function choisir(a: ArticleCatalogue) {
    vientDeChoisir.current = true;
    onChoisir(a.id);
    setTexte(a.designation);
    setOuvert(false);
  }

  function quitter() {
    setOuvert(false);
    if (vientDeChoisir.current) {
      vientDeChoisir.current = false;
      return;
    }
    // Texte qui ne correspond à aucun choix : on revient à l'article choisi (ou à vide)
    const exact = catalogue?.find((a) => normaliser(a.designation) === normaliser(texte.trim()));
    if (exact && exact.id !== articleId) choisir(exact);
    else setTexte(choisi?.designation ?? '');
  }

  function clavier(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!ouvert) return setOuvert(true);
      const n = resultats.length;
      if (n) setActif((i) => (e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n));
    } else if (e.key === 'Enter' && ouvert) {
      e.preventDefault(); // pas d'envoi du formulaire
      if (resultats[actif]) choisir(resultats[actif]);
    } else if (e.key === 'Tab' && !e.shiftKey && ouvert && texte.trim() && resultats.length === 1) {
      // Un seul article possible : Tab le choisit, puis passe au champ suivant
      if (resultats[0].id !== articleId) choisir(resultats[0]);
    } else if (e.key === 'Escape' && ouvert) {
      e.preventDefault();
      setOuvert(false);
      setTexte(choisi?.designation ?? '');
    }
  }

  const vide = catalogue !== null && catalogue.length === 0;
  const idActif = ouvert && resultats[actif] ? `${idListe}-${actif}` : undefined;

  return (
    <div className="recherche-article">
      <span className="recherche-article__icone" aria-hidden="true">
        <IconRecherche taille={18} />
      </span>
      <input
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={ouvert}
        aria-controls={idListe}
        aria-activedescendant={idActif}
        autoComplete="off"
        required
        autoFocus={autoFocus}
        disabled={vide}
        placeholder={catalogue === null ? 'Chargement du catalogue…' : vide ? 'Catalogue du magasin vide' : 'Rechercher un article'}
        value={texte}
        onChange={(e) => {
          vientDeChoisir.current = false;
          setTexte(e.target.value);
          setActif(0);
          setOuvert(true);
          if (articleId) onChoisir(''); // la saisie annule le choix précédent jusqu'au nouveau choix
        }}
        onFocus={(e) => {
          vientDeChoisir.current = false;
          e.target.select();
          setActif(0);
          setOuvert(true);
        }}
        onBlur={quitter}
        onKeyDown={clavier}
      />
      {ouvert && catalogue !== null && !vide && (
        <ul ref={liste} id={idListe} role="listbox" aria-label={ariaLabel} className="recherche-article__liste">
          {resultats.length === 0 ? (
            <li className="recherche-article__aucun" role="presentation">
              Aucun article ne correspond à « {texte.trim()} ».
            </li>
          ) : (
            resultats.map((a, i) => (
              <li
                key={a.id}
                id={`${idListe}-${i}`}
                data-index={i}
                role="option"
                aria-selected={a.id === articleId}
                className={`recherche-article__option${i === actif ? ' recherche-article__option--active' : ''}`}
                // mousedown plutôt que click : le choix passe avant la perte du focus
                onMouseDown={(e) => {
                  e.preventDefault();
                  choisir(a);
                }}
                onMouseMove={() => setActif(i)}
              >
                <span className="recherche-article__nom">{a.designation}</span>
                <span className="recherche-article__detail">
                  {a.reference} · {a.unite}
                  {a.categorie && ` · ${a.categorie}`}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
