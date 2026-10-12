import { useMemo, useState } from 'react';

/** Outils de date du planning hebdomadaire (heure locale du navigateur). */
export const JOURS_OUVRES = 5; // du lundi au vendredi

const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
const fmtCourt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const fmtAnnee = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Lundi 00:00 de la semaine contenant `d`. */
export function lundiDe(d: Date) {
  const l = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  l.setDate(l.getDate() - ((l.getDay() + 6) % 7));
  return l;
}
export const plusJours = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const memeJour = (a: Date, b: Date) => a.toDateString() === b.toDateString();
/** « lundi 12 oct. » → « Lundi 12 oct. » */
export const nomDuJour = (d: Date) => fmtJour.format(d).replace(/^./, (c) => c.toUpperCase());
/** « Semaine du 12 octobre au 16 octobre 2026 » */
export const libelleSemaine = (lundi: Date) =>
  `Semaine du ${fmtCourt.format(lundi)} au ${fmtAnnee.format(plusJours(lundi, JOURS_OUVRES - 1))}`;
/** Date locale au format du champ date (AAAA-MM-JJ). */
export const versChamp = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Semaine affichée : jour choisi, son lundi, les jours ouvrés et la période à demander à l'API. */
export function useSemaine() {
  const [jourChoisi, setJourChoisi] = useState(() => new Date());
  const debut = lundiDe(jourChoisi).getTime();
  const lundi = useMemo(() => new Date(debut), [debut]);
  const jours = useMemo(() => Array.from({ length: JOURS_OUVRES }, (_, i) => plusJours(lundi, i)), [lundi]);
  return {
    jourChoisi,
    setJourChoisi,
    lundi,
    jours,
    du: lundi.toISOString(),
    au: plusJours(lundi, JOURS_OUVRES).toISOString(),
    estCetteSemaine: memeJour(lundi, lundiDe(new Date())),
  };
}
