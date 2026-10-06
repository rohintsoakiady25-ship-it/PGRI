import { useTheme } from './theme';
import './BoutonTheme.css';

const icone = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

/** Bouton de bascule entre le thème clair et le thème sombre. */
export default function BoutonTheme({ className = '' }: { className?: string }) {
  const { theme, basculer } = useTheme();
  const sombre = theme === 'dark';
  const libelle = sombre ? 'Passer en mode clair' : 'Passer en mode sombre';

  return (
    <button type="button" className={`bouton-theme ${className}`} onClick={basculer} aria-label={libelle} title={libelle}>
      {sombre ? (
        <svg {...icone}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </svg>
      ) : (
        <svg {...icone}>
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  );
}
