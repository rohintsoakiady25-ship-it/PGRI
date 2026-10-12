import { IconChevron } from '@/components/common/icons';
import { plusJours, versChamp } from '../semaine';
import './NavigationSemaine.css';

interface Props {
  jourChoisi: Date;
  onChange: (jour: Date) => void;
  estCetteSemaine: boolean;
}

/** Barre d'outils du planning : Aujourd'hui, semaine précédente / suivante, choix d'une date. */
export default function NavigationSemaine({ jourChoisi, onChange, estCetteSemaine }: Props) {
  return (
    <nav className="navigation-semaine" aria-label="Changer de semaine">
      <button type="button" className="outil" aria-pressed={estCetteSemaine} onClick={() => onChange(new Date())}>
        Aujourd’hui
      </button>
      <div className="outil-groupe" role="group" aria-label="Semaine précédente ou suivante">
        <button
          type="button"
          className="outil outil--icone outil--precedent"
          onClick={() => onChange(plusJours(jourChoisi, -7))}
          aria-label="Semaine précédente"
          title="Semaine précédente"
        >
          <IconChevron taille={18} />
        </button>
        <button
          type="button"
          className="outil outil--icone"
          onClick={() => onChange(plusJours(jourChoisi, 7))}
          aria-label="Semaine suivante"
          title="Semaine suivante"
        >
          <IconChevron taille={18} />
        </button>
      </div>
      <label className="outil outil--date" title="Aller à une date">
        <input
          type="date"
          aria-label="Afficher la semaine du jour choisi"
          value={versChamp(jourChoisi)}
          onChange={(e) => e.target.value && onChange(new Date(`${e.target.value}T00:00:00`))}
        />
      </label>
    </nav>
  );
}
