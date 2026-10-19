import { useEffect, useId, useRef, useState } from 'react';
import { nommerPoint, rechercherLieux, type Lieu } from './lieux';
import './ChampLieu.css';

interface ChampLieuProps {
  id: string;
  name: string;
  valeur: Lieu | null;
  onChange: (lieu: Lieu | null) => void;
  placeholder?: string;
  /** Propose « Ma position actuelle » en tête de liste (géolocalisation du navigateur). */
  positionActuelle?: boolean;
}

type Option = { type: 'position' } | { type: 'lieu'; lieu: Lieu };

/** Position GPS du navigateur ; message lisible en cas d'échec. */
function localiser(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext || !('geolocation' in navigator)) {
      reject(new Error('La localisation n’est pas disponible sur cette adresse (connexion non sécurisée).'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (e) => {
      reject(
        new Error(
          e.code === e.PERMISSION_DENIED
            ? 'Localisation refusée : autorisez-la dans le navigateur ou cherchez le lieu.'
            : e.code === e.TIMEOUT
              ? 'Position introuvable à temps. Réessayez ou cherchez le lieu.'
              : 'Position indisponible. Cherchez le lieu ou cliquez sur la carte.',
        ),
      );
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}

/** Champ de saisie avec suggestions de lieux (combobox accessible au clavier). */
export default function ChampLieu({ id, name, valeur, onChange, placeholder, positionActuelle = false }: ChampLieuProps) {
  const [texte, setTexte] = useState(valeur?.nom ?? '');
  const [suggestions, setSuggestions] = useState<Lieu[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  const [etat, setEtat] = useState<'repos' | 'recherche' | 'vide' | 'erreur' | 'localisation'>('repos');
  const [erreurPosition, setErreurPosition] = useState<string | null>(null);
  const saisieUtilisateur = useRef(false);
  const listeId = useId();

  const options: Option[] = [
    ...(positionActuelle ? [{ type: 'position' } as const] : []),
    ...suggestions.map((lieu) => ({ type: 'lieu', lieu }) as const),
  ];

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
        // Le premier lieu trouvé est présélectionné (la position actuelle reste au-dessus)
        setActif(lieux.length ? (positionActuelle ? 1 : 0) : -1);
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
  }, [texte, positionActuelle]);

  function choisir(lieu: Lieu) {
    onChange(lieu);
    setOuvert(false);
    setSuggestions([]);
  }

  async function choisirPosition() {
    setOuvert(false);
    setErreurPosition(null);
    setEtat('localisation');
    try {
      const { coords } = await localiser();
      const lieu = await nommerPoint(coords.longitude, coords.latitude);
      choisir({ ...lieu, detail: ['Ma position actuelle', lieu.detail].filter(Boolean).join(' · ') });
      setEtat('repos');
    } catch (e) {
      setErreurPosition((e as Error).message);
      setEtat('repos');
    }
  }

  function valider(option: Option) {
    if (option.type === 'position') void choisirPosition();
    else choisir(option.lieu);
  }

  function auClavier(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!ouvert && e.key === 'ArrowDown' && options.length) {
      e.preventDefault();
      setOuvert(true);
      setActif(0);
      return;
    }
    if (!ouvert || !options.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActif((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Enter' && actif >= 0 && options[actif]) {
      e.preventDefault();
      valider(options[actif]);
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
        aria-describedby={erreurPosition ? `${id}-erreur-position` : undefined}
        autoComplete="off"
        placeholder={etat === 'localisation' ? 'Localisation en cours…' : placeholder}
        value={texte}
        onChange={(e) => {
          saisieUtilisateur.current = true;
          setErreurPosition(null);
          setTexte(e.target.value);
          if (valeur) onChange(null);
        }}
        onKeyDown={auClavier}
        onFocus={() => {
          if (options.length) {
            setOuvert(true);
            if (actif < 0) setActif(0);
          }
        }}
        onBlur={() => window.setTimeout(() => setOuvert(false), 150)}
      />
      {(etat === 'recherche' || etat === 'localisation') && <span className="champ-lieu__spinner" aria-hidden="true" />}

      {ouvert && (options.length > 0 || message) && (
        <ul id={listeId} role="listbox" className="champ-lieu__liste">
          {options.map((o, i) => (
            <li
              key={o.type === 'position' ? 'position' : `${o.lieu.lon},${o.lieu.lat}`}
              id={`${listeId}-${i}`}
              role="option"
              aria-selected={i === actif}
              className={`champ-lieu__option${o.type === 'position' ? ' champ-lieu__option--position' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => valider(o)}
              onMouseEnter={() => setActif(i)}
            >
              {o.type === 'position' ? (
                <span className="champ-lieu__nom champ-lieu__position">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="3.5" />
                    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
                    <circle cx="12" cy="12" r="7" />
                  </svg>
                  Ma position actuelle
                </span>
              ) : (
                <>
                  <span className="champ-lieu__nom">{o.lieu.nom}</span>
                  {o.lieu.detail && <span className="champ-lieu__detail">{o.lieu.detail}</span>}
                </>
              )}
            </li>
          ))}
          {!suggestions.length && message && <li className="champ-lieu__message">{message}</li>}
        </ul>
      )}
      {erreurPosition && (
        <p id={`${id}-erreur-position`} className="champ-lieu__erreur" role="alert">
          {erreurPosition}
        </p>
      )}
    </div>
  );
}
