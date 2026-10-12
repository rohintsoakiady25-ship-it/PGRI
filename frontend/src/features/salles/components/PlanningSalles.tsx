import { heure, minutesDe, type Occupation, type Salle } from '../api';
import './PlanningSalles.css';

export const OUVERTURE = 7 * 60;
export const FERMETURE = 19 * 60;
const QUART = 15;
const HEURES = Array.from({ length: (FERMETURE - OUVERTURE) / 60 }, (_, i) => OUVERTURE / 60 + i);

/** Colonne de grille (1 colonne = 15 min) d'une heure exprimée en minutes. */
const colonne = (minutes: number) => Math.round((Math.min(Math.max(minutes, OUVERTURE), FERMETURE) - OUVERTURE) / QUART) + 1;

interface Props {
  salles: Salle[];
  occupations: Occupation[];
  /** Créneau en cours de saisie, mis en évidence. */
  selection: { salleId: string; debut: number; fin: number } | null;
  /** Clic sur une heure : choisit la salle et fait commencer le créneau à cette heure. */
  onChoisir: (salleId: string, minutes: number) => void;
}

/** Planning de la journée : une ligne par salle, de 7 h à 19 h. */
export default function PlanningSalles({ salles, occupations, selection, onChoisir }: Props) {
  return (
    <div className="planning">
      <div className="planning__ligne planning__ligne--entete" aria-hidden="true">
        <span />
        <div className="planning__heures">
          {HEURES.map((h) => (
            <span key={h} className="planning__heure">
              {h}h
            </span>
          ))}
        </div>
      </div>

      {salles.map((s) => {
        const occ = occupations.filter((o) => o.salleId === s.id);
        return (
          <div key={s.id} className="planning__ligne">
            <span className="planning__salle">{s.nom}</span>
            <div className="planning__piste">
              {HEURES.map((h) => {
                const pris = occ.some((o) => minutesDe(o.debut) < (h + 1) * 60 && minutesDe(o.fin) > h * 60);
                return (
                  <button
                    key={h}
                    type="button"
                    className="planning__case"
                    style={{ gridColumn: `${colonne(h * 60)} / span 4` }}
                    onClick={() => onChoisir(s.id, h * 60)}
                    aria-label={`${s.nom}, ${h}h : ${pris ? 'en partie occupée' : 'libre'}. Choisir ce créneau.`}
                  />
                );
              })}
              {occ.map((o) => (
                <span
                  key={o.id}
                  className={`planning__bloc planning__bloc--${o.statut === 'CONFIRMEE' ? 'confirme' : 'attente'}${o.moi ? ' planning__bloc--moi' : ''}`}
                  style={{ gridColumn: `${colonne(minutesDe(o.debut))} / ${colonne(minutesDe(o.fin))}` }}
                  title={`${heure(o.debut)} – ${heure(o.fin)} · ${o.statut === 'CONFIRMEE' ? 'Confirmée' : 'En attente'}${o.objet ? ` · ${o.objet}` : ''}${o.moi ? ' (vous)' : ''}`}
                >
                  <span className="planning__bloc-texte">
                    {heure(o.debut)}–{heure(o.fin)}
                  </span>
                </span>
              ))}
              {selection?.salleId === s.id && selection.fin > selection.debut && (
                <span
                  className="planning__selection"
                  style={{ gridColumn: `${colonne(selection.debut)} / ${colonne(selection.fin)}` }}
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        );
      })}

      <ul className="planning__legende" aria-label="Légende">
        <li><span className="planning__puce planning__puce--confirme" /> Confirmée</li>
        <li><span className="planning__puce planning__puce--attente" /> En attente de validation</li>
        <li><span className="planning__puce planning__puce--selection" /> Votre choix</li>
      </ul>
    </div>
  );
}
