/**
 * Thème clair / sombre.
 * - Sans choix enregistré, le thème suit le réglage du système (et ses changements).
 * - Un clic sur le bouton enregistre un choix explicite dans le navigateur.
 * Le thème initial est posé par un petit script dans index.html, avant le premier rendu.
 */
import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const CLE = 'pgri.theme';
const requeteSombre = '(prefers-color-scheme: dark)';

function choixEnregistre(): Theme | null {
  try {
    const v = localStorage.getItem(CLE);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function themeSysteme(): Theme {
  return window.matchMedia(requeteSombre).matches ? 'dark' : 'light';
}

function appliquer(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** Thème courant et fonction de bascule ; garde tous les boutons de la page synchronisés. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme | undefined) ?? choixEnregistre() ?? themeSysteme(),
  );

  useEffect(() => {
    // Suivre le système tant qu'aucun choix n'est enregistré
    const media = window.matchMedia(requeteSombre);
    const auChangementSysteme = () => {
      if (!choixEnregistre()) {
        const t = themeSysteme();
        appliquer(t);
        setTheme(t);
      }
    };
    // Rester synchronisé avec les autres boutons (et les autres onglets)
    const observateur = new MutationObserver(() =>
      setTheme((document.documentElement.dataset.theme as Theme) ?? 'light'),
    );
    observateur.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const auStockage = (e: StorageEvent) => {
      if (e.key === CLE) appliquer(choixEnregistre() ?? themeSysteme());
    };
    media.addEventListener('change', auChangementSysteme);
    window.addEventListener('storage', auStockage);
    return () => {
      media.removeEventListener('change', auChangementSysteme);
      window.removeEventListener('storage', auStockage);
      observateur.disconnect();
    };
  }, []);

  function basculer() {
    const suivant: Theme = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(CLE, suivant);
    } catch {
      /* stockage indisponible : le choix vaut pour cette page seulement */
    }
    appliquer(suivant);
    setTheme(suivant);
  }

  return { theme, basculer };
}
