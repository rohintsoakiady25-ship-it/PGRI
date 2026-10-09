import { useEffect, useRef, type ReactNode } from 'react';
import './Modale.css';

interface ModaleProps {
  ouverte: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
}

/** Fenêtre modale (élément <dialog> natif : focus piégé, Échap pour fermer). */
export default function Modale({ ouverte, titre, onFermer, children }: ModaleProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouverte && !d.open) d.showModal();
    if (!ouverte && d.open) d.close();
  }, [ouverte]);

  return (
    <dialog
      ref={ref}
      className="modale"
      aria-labelledby="modale-titre"
      onCancel={(e) => {
        e.preventDefault();
        onFermer();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onFermer(); // clic sur le fond
      }}
    >
      <div className="modale__contenu">
        <div className="modale__entete">
          <h2 id="modale-titre" className="modale__titre">
            {titre}
          </h2>
          <button type="button" className="modale__fermer" onClick={onFermer} aria-label="Fermer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
              strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {ouverte && children}
      </div>
    </dialog>
  );
}
