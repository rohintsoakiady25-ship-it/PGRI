import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import './DemandePage.css';

export interface EtapeCircuit {
  titre: string;
  detail: string;
}

interface DemandePageProps {
  titre: string;
  intro: string;
  circuit: EtapeCircuit[];
  noteCircuit?: string;
  children: ReactNode;
}

/** Gabarit commun des pages de demande : formulaire à gauche, circuit de validation à droite. */
export default function DemandePage({ titre, intro, circuit, noteCircuit, children }: DemandePageProps) {
  return (
    <AppLayout>
      <div className="demande">
        <p className="demande__back">
          <Link to="/accueil">← Retour à l'accueil</Link>
        </p>
        <h1 className="demande__title">{titre}</h1>
        <p className="demande__intro">{intro}</p>

        <div className="demande__grid">
          <form className="demande__form" noValidate>
            {children}
            <div className="demande__actions">
              <button type="button" className="btn btn--secondary">
                Enregistrer le brouillon
              </button>
              <button type="submit" className="btn btn--primary">
                Soumettre la demande
              </button>
            </div>
          </form>

          <aside className="circuit" aria-labelledby="circuit-titre">
            <h2 id="circuit-titre" className="circuit__title">
              Circuit de validation
            </h2>
            <ol className="circuit__steps">
              {circuit.map((etape) => (
                <li key={etape.titre} className="circuit__step">
                  <span className="circuit__step-title">{etape.titre}</span>
                  <span className="circuit__step-detail">{etape.detail}</span>
                </li>
              ))}
            </ol>
            {noteCircuit && <p className="circuit__note">{noteCircuit}</p>}
            <p className="circuit__note">Vous recevez un e-mail à chaque étape.</p>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}

/** Section du formulaire. */
export function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <fieldset className="section">
      <legend className="section__title">{titre}</legend>
      <div className="section__body">{children}</div>
    </fieldset>
  );
}

/** Champ avec libellé ; `large` occupe toute la largeur de la grille. */
export function Champ({
  id, label, optionnel, aide, large, children,
}: { id: string; label: string; optionnel?: boolean; aide?: string; large?: boolean; children: ReactNode }) {
  return (
    <div className={`champ${large ? ' champ--large' : ''}`}>
      <label htmlFor={id} className="champ__label">
        {label}
        {optionnel && <span className="champ__optional"> (facultatif)</span>}
      </label>
      {children}
      {aide && <p className="champ__aide">{aide}</p>}
    </div>
  );
}
