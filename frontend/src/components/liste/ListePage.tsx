import type { ReactNode } from 'react';
import AppLayout from '@/layouts/AppLayout';
import { IconRecherche } from '@/components/common/icons';
import './ListePage.css';

export interface FiltreListe {
  id: string;
  label: string;
  options: { valeur: string; libelle: string }[];
  valeur: string;
  onChange: (valeur: string) => void;
}

export interface LigneListe {
  cle: string;
  cellules: ReactNode[];
  /** Ligne grisée (ex. élément hors service). */
  attenuee?: boolean;
}

interface ListePageProps {
  titre: string;
  intro: string;
  placeholderRecherche: string;
  recherche: string;
  onRecherche: (texte: string) => void;
  filtres?: FiltreListe[];
  colonnes: { label: string; numerique?: boolean; sr?: boolean }[];
  lignes: LigneListe[];
  chargement: boolean;
  erreur: string | null;
  /** Message quand la liste est vide (aucune donnée) ; un autre est affiché si les filtres excluent tout. */
  messageVide: string;
  /** Nombre total d'éléments avant filtrage. */
  total: number;
  /** Bouton à droite du titre (ex. « Ajouter »). */
  action?: ReactNode;
}

/** Gabarit des pages de liste : recherche, filtres, tableau, chargement, erreur, état vide. */
export default function ListePage({
  titre, intro, placeholderRecherche, recherche, onRecherche, filtres = [], colonnes, lignes, chargement, erreur,
  messageVide, total, action,
}: ListePageProps) {
  const filtreActif = Boolean(recherche.trim()) || filtres.some((f) => f.valeur);
  let messageCorps: ReactNode = null;
  if (chargement) messageCorps = 'Chargement…';
  else if (erreur) messageCorps = <span className="liste__erreur">{erreur}</span>;
  else if (!lignes.length) messageCorps = total && filtreActif ? 'Aucun résultat pour cette recherche ou ces filtres.' : messageVide;

  return (
    <AppLayout>
      <div className="liste">
        <div className="liste__entete">
          <div>
            <h1 className="liste__titre">{titre}</h1>
            <p className="liste__intro">{intro}</p>
          </div>
          {action}
        </div>

        <div className="liste__outils" role="search">
          <label className="liste__recherche">
            <span className="sr-only">Rechercher</span>
            <IconRecherche />
            <input type="search" placeholder={placeholderRecherche} value={recherche} onChange={(e) => onRecherche(e.target.value)} />
          </label>
          {filtres.map((f) => (
            <label key={f.id} className="liste__filtre">
              <span className="liste__filtre-label">{f.label}</span>
              <select value={f.valeur} onChange={(e) => f.onChange(e.target.value)}>
                <option value="">Tous</option>
                {f.options.map((o) => (
                  <option key={o.valeur} value={o.valeur}>
                    {o.libelle}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="liste__cadre">
          <table className="liste__table" aria-busy={chargement}>
            <thead>
              <tr>
                {colonnes.map((c) => (
                  <th key={c.label} scope="col" className={c.numerique ? 'liste__num' : undefined}>
                    {c.sr ? <span className="sr-only">{c.label}</span> : c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {messageCorps ? (
                <tr>
                  <td colSpan={colonnes.length} className="liste__vide" role={erreur ? 'alert' : undefined}>
                    {messageCorps}
                  </td>
                </tr>
              ) : (
                lignes.map((ligne) => (
                  <tr key={ligne.cle} className={ligne.attenuee ? 'liste__ligne--attenuee' : undefined}>
                    {ligne.cellules.map((cellule, j) => (
                      <td key={j} className={colonnes[j]?.numerique ? 'liste__num' : undefined}>
                        {cellule}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!chargement && !erreur && (
          <p className="liste__compte" aria-live="polite">
            {filtreActif ? `${lignes.length} sur ${total} ` : `${total} `}
            résultat{(filtreActif ? lignes.length : total) > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </AppLayout>
  );
}
