import type { CSSProperties } from 'react';
import { heure, LIBELLE_STATUT, minutesDe, type StatutSalle } from '../api';
import { memeJour, nomDuJour } from '../semaine';
import './GrilleSemaine.css';

export const HEURE_DEBUT = 8; // première heure affichée
export const HEURE_FIN = 18; // dernière heure affichée
const HEURES = Array.from({ length: HEURE_FIN - HEURE_DEBUT }, (_, i) => HEURE_DEBUT + i);
const QUARTS_PAR_HEURE = 4;
const ENTETE = 2; // lignes de grille : jours, puis salles

export interface SalleGrille {
  id: string;
  nom: string;
  capacite: number;
  actif: boolean;
}

export interface CreneauGrille {
  id: string;
  salleId: string;
  debut: string;
  fin: string;
  statut: StatutSalle;
  objet: string;
  /** Ligne secondaire (ex. nom du demandeur) ; absente sur le planning public. */
  sousTitre?: string;
}

interface Props {
  salles: SalleGrille[];
  creneaux: CreneauGrille[];
  jours: Date[];
  chargement?: boolean;
  /** Clic sur une réservation ; sans lui, les réservations ne sont pas cliquables. */
  onOuvrir?: (id: string) => void;
  /** Afficher « En attente de validation » dans la légende (pas sur le planning public). */
  avecAttente?: boolean;
}

/** Ligne de grille d'une heure (en minutes), limitée à la plage affichée. */
const ligneDe = (minutes: number) =>
  ENTETE + 1 + Math.round((Math.min(Math.max(minutes, HEURE_DEBUT * 60), HEURE_FIN * 60) - HEURE_DEBUT * 60) / (60 / QUARTS_PAR_HEURE));

const classeStatut = (s: StatutSalle) => (s === 'EN_ATTENTE_LOGISTIQUE' ? 'attente' : s === 'TERMINEE' ? 'terminee' : 'confirmee');

/** Grille de la semaine : une colonne par salle et par jour, une ligne par heure de 8 h à 18 h. */
export default function GrilleSemaine({ salles, creneaux, jours, chargement, onOuvrir, avecAttente = true }: Props) {
  const nbSalles = salles.length;
  const aujourdhui = new Date();
  /** Colonne de grille d'une salle un jour donné (la colonne 1 porte les heures). */
  const colonneDe = (jour: number, salle: number) => 2 + jour * nbSalles + salle;

  return (
    <>
      <div className="grille-cadre" aria-busy={chargement}>
        <div
          className="grille"
          style={{ '--nb-colonnes': jours.length * nbSalles, '--nb-quarts': HEURES.length * QUARTS_PAR_HEURE } as CSSProperties}
        >
          {/* En-tête : jours, puis une colonne par salle */}
          <span className="grille__coin" style={{ gridColumn: 1, gridRow: '1 / span 2' }} />
          {jours.map((j, ji) => {
            const auj = memeJour(j, aujourdhui);
            return (
              <span
                key={`j${ji}`}
                className={`grille__jour${auj ? ' grille__jour--aujourdhui' : ''}`}
                style={{ gridColumn: `${colonneDe(ji, 0)} / span ${nbSalles}`, gridRow: 1 }}
              >
                {nomDuJour(j)}
                {auj && <span className="grille__pastille">Aujourd’hui</span>}
              </span>
            );
          })}
          {jours.flatMap((_, ji) =>
            salles.map((s, si) => (
              <span
                key={`s${ji}-${si}`}
                className={`grille__salle${si === 0 ? ' grille__debut-jour' : ''}`}
                style={{ gridColumn: colonneDe(ji, si), gridRow: 2 }}
                title={`${s.nom} · ${s.capacite} places${s.actif ? '' : ' · hors service'}`}
              >
                {s.nom}
              </span>
            )),
          )}

          {/* Heures et cases d'une heure */}
          {HEURES.map((h, hi) => {
            const ligne = `${ENTETE + 1 + hi * QUARTS_PAR_HEURE} / span ${QUARTS_PAR_HEURE}`;
            return [
              <span key={`h${h}`} className={`grille__heure${hi === 0 ? ' grille__heure--premiere' : ''}`} style={{ gridColumn: 1, gridRow: ligne }}>
                {h}h
              </span>,
              ...jours.flatMap((j, ji) =>
                salles.map((_, si) => (
                  <span
                    key={`c${h}-${ji}-${si}`}
                    className={`grille__case${si === 0 ? ' grille__debut-jour' : ''}${memeJour(j, aujourdhui) ? ' grille__case--aujourdhui' : ''}`}
                    style={{ gridColumn: colonneDe(ji, si), gridRow: ligne }}
                    aria-hidden="true"
                  />
                )),
              ),
            ];
          })}
          <span className="grille__heure grille__heure--fin" style={{ gridColumn: 1, gridRow: ENTETE + 1 + HEURES.length * QUARTS_PAR_HEURE }}>
            {HEURE_FIN}h
          </span>

          {/* Réservations, placées selon leur créneau */}
          {creneaux.map((r) => {
            const ji = jours.findIndex((j) => memeJour(new Date(r.debut), j));
            const si = salles.findIndex((s) => s.id === r.salleId);
            if (ji < 0 || si < 0) return null;
            const debut = minutesDe(r.debut);
            const fin = minutesDe(r.fin);
            if (fin <= HEURE_DEBUT * 60 || debut >= HEURE_FIN * 60) return null; // hors de la plage affichée
            const court = fin - debut <= 45;
            const salle = salles[si].nom;
            const contenu = (
              <>
                <span className="resa__heure">
                  {heure(r.debut)} – {heure(r.fin)}
                </span>
                <span className="resa__objet">{r.objet}</span>
                {!court && r.sousTitre && <span className="resa__qui">{r.sousTitre}</span>}
              </>
            );
            const props = {
              className: `resa resa--${classeStatut(r.statut)}${court ? ' resa--court' : ''}${onOuvrir ? ' resa--cliquable' : ''}`,
              style: { gridColumn: colonneDe(ji, si), gridRow: `${ligneDe(debut)} / ${ligneDe(fin)}` },
              title: `${heure(r.debut)} – ${heure(r.fin)} · ${salle}\n${r.objet}${r.sousTitre ? `\n${r.sousTitre}` : ''}\n${LIBELLE_STATUT[r.statut]}`,
            };
            const description = `${nomDuJour(jours[ji])}, ${salle}, ${heure(r.debut)} à ${heure(r.fin)} : ${r.objet}${r.sousTitre ? `, ${r.sousTitre}` : ''}, ${LIBELLE_STATUT[r.statut]}`;
            return onOuvrir ? (
              <button key={r.id} type="button" {...props} onClick={() => onOuvrir(r.id)} aria-label={`${description}. Ouvrir.`}>
                {contenu}
              </button>
            ) : (
              <div key={r.id} {...props} role="note" aria-label={description}>
                {contenu}
              </div>
            );
          })}
        </div>
      </div>

      <ul className="grille-legende" aria-label="Légende">
        <li><span className="resa-puce resa-puce--confirmee" /> Confirmée</li>
        {avecAttente && <li><span className="resa-puce resa-puce--attente" /> En attente de validation</li>}
        <li><span className="resa-puce resa-puce--terminee" /> Terminée</li>
      </ul>
    </>
  );
}
