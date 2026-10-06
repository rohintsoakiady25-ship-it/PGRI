import type { ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import { IconRecherche } from '@/components/common/icons';
import './ListePage.css';

interface Filtre {
  id: string;
  label: string;
  options: string[];
}

interface ListePageProps {
  titre: string;
  intro: string;
  placeholderRecherche: string;
  filtres?: Filtre[];
  colonnes: { label: string; numerique?: boolean }[];
  /** Lignes du tableau ; vide tant que les données ne sont pas branchées. */
  lignes?: ReactNode[][];
  messageVide: string;
}

/** Gabarit des pages de liste : recherche, filtres, tableau, état vide. Données non branchées. */
export default function ListePage({
  titre, intro, placeholderRecherche, filtres = [], colonnes, lignes = [], messageVide,
}: ListePageProps) {
  return (
    <AppLayout>
      <div className="liste">
        <h1 className="liste__titre">{titre}</h1>
        <p className="liste__intro">{intro}</p>

        <div className="liste__outils" role="search">
          <label className="liste__recherche">
            <span className="sr-only">Rechercher</span>
            <IconRecherche />
            <input type="search" placeholder={placeholderRecherche} />
          </label>
          {filtres.map((f) => (
            <label key={f.id} className="liste__filtre">
              <span className="liste__filtre-label">{f.label}</span>
              <select defaultValue="">
                <option value="">Tous</option>
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="liste__cadre">
          <table className="liste__table">
            <thead>
              <tr>
                {colonnes.map((c) => (
                  <th key={c.label} scope="col" className={c.numerique ? 'liste__num' : undefined}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.length ? (
                lignes.map((ligne, i) => (
                  <tr key={i}>
                    {ligne.map((cellule, j) => (
                      <td key={j} className={colonnes[j]?.numerique ? 'liste__num' : undefined}>
                        {cellule}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={colonnes.length} className="liste__vide">
                    {messageVide}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="liste__compte">
          {lignes.length} résultat{lignes.length > 1 ? 's' : ''}
        </p>
      </div>
    </AppLayout>
  );
}
