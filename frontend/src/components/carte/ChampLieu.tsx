import { useEffect, useId, useRef, useState } from 'react';
import { rechercherLieux, type Lieu } from './lieux';
import './ChampLieu.css';

interface ChampLieuProps {
  id: string;
  name: string;
  valeur: Lieu | null;
  onChange: (lieu: Lieu | null) => void;
  placeholder?: string;
}

/** Champ de saisie avec suggestions de lieux (combobox accessible au clavier). */
export default function ChampLieu({ id, name, valeur, onChange, placeholder }: ChampLieuProps) {
  const [texte, setTexte] = useState(valeur?.nom ?? '');
  const [suggestions, setSuggestions] = useState<Lieu[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const [etat, setEtat] = useState<'repos' | 'recherche' | 'vide' | 'erreur'>('repos');
  const saisieUtilisateur = useRef(false);
  const listeId = useId();

  // Un lieu choisi ailleurs (clic sur la carte) remplace le texte du champ
  useEffect(() => {
    if (!valeur) return; // effacé pendant la saisie : on garde le texte tapé
    saisieUtilisateur.current = false;
    setTexte(valeur.nom);
  }, [valeur]);

  // Recherche différée pendant la saisie
  useEffect(() => {
    if (!saisieUtilisateur.current) return;
    const requete = texte.trim();
    if (requete.length < 3) {
      setSuggestions([]);
      setEtat('repos');
      return;
    }
    const annulation = new AbortController();
    const minuterie = window.setTimeout(async () => {
      setEtat('recherche');
      try {
        const lieux = await rechercherLieux(requete, annulation.signal);
        setSuggestions(lieux);
        setActif(lieux.length ? 0 : -1);
        setEtat(lieux.length ? 'repos' : 'vide');
        setOuvert(true);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setSuggestions([]);
          setEtat('erreur');
          setOuvert(true);
        }
      }
    }, 450);
    return () => {
      window.clearTimeout(minuterie);
      annulation.abort();
    };
  }, [texte]);

  function choisir(lieu: Lieu) {
    onChange(lieu);
    setOuvert(false);
    setSuggestions([]);
  }

  function auClavier(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!ouvert || !suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActif((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && actif >= 0) {
      e.preventDefault();
      choisir(suggestions[actif]);
    } else if (e.key === 'Escape') {
      setOuvert(false);
    }
  }

  const message =
    etat === 'recherche' ? 'Recherche…' :
    etat === 'vide' ? 'Aucun lieu trouvé à Madagascar. Essayez un autre nom ou cliquez sur la carte.' :
    etat === 'erreur' ? 'Recherche indisponible. Vérifiez la connexion ou cliquez sur la carte.' : null;

  return (
    <div className="champ-lieu">
      <input
        id={id}
        name={name}
        type="search"
        role="combobox"
        aria-expanded={ouvert}
        aria-controls={listeId}
        aria-autocomplete="list"
        aria-activedescendant={ouvert && actif >= 0 ? `${listeId}-${actif}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={texte}
        onChange={(e) => {
          saisieUtilisateur.current = true;
          setTexte(e.target.value);
          if (valeur) onChange(null);
        }}
        onKeyDown={auClavier}
        onFocus={() => suggestions.length && setOuvert(true)}
        onBlur={() => window.setTimeout(() => setOuvert(false), 150)}
      />
      {etat === 'recherche' && <span className="champ-lieu__spinner" aria-hidden="true" />}

      {ouvert && (suggestions.length > 0 || message) && (
        <ul id={listeId} role="listbox" className="champ-lieu__liste">
          {suggestions.map((lieu, i) => (
            <li
              key={`${lieu.lon},${lieu.lat}`}
              id={`${listeId}-${i}`}
              role="option"
              aria-selected={i === actif}
              className="champ-lieu__option"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choisir(lieu)}
              onMouseEnter={() => setActif(i)}
            >
              <span className="champ-lieu__nom">{lieu.nom}</span>
              {lieu.detail && <span className="champ-lieu__detail">{lieu.detail}</span>}
            </li>
          ))}
          {!suggestions.length && message && <li className="champ-lieu__message">{message}</li>}
        </ul>
      )}
    </div>
  );
}
