import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import Modale from '@/components/common/Modale';
import { IconChevron } from '@/components/common/icons';
import { messageErreur } from '@/api/client';
import { demandesSalleApi, heure, LIBELLE_STATUT, minutesDe, sallesApi, type DemandeSalle, type Salle } from '../api';
import DetailDemandeSalle from '../components/DetailDemandeSalle';
import './PlanningSemainePage.css';

const JOURS = 5; // du lundi au vendredi
const DEBUT = 8; // première heure affichée
const FIN = 18; // dernière heure affichée
const HEURES = Array.from({ length: FIN - DEBUT }, (_, i) => DEBUT + i);
const QUARTS_PAR_HEURE = 4;
const ENTETE = 2; // lignes de grille : jours, puis salles

const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
const fmtCourt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const fmtAnnee = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Lundi 00:00 (heure locale) de la semaine contenant `d`. */
function lundiDe(d: Date) {
  const l = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  l.setDate(l.getDate() - ((l.getDay() + 6) % 7));
  return l;
}
/** « lundi 12 oct. » → « Lundi 12 oct. » */
const nomDuJour = (d: Date) => fmtJour.format(d).replace(/^./, (c) => c.toUpperCase());
const plusJours = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const memeJour = (a: Date, b: Date) => a.toDateString() === b.toDateString();
/** Date locale au format du champ date (AAAA-MM-JJ). */
const versChamp = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Ligne de grille d'une heure (en minutes), limitée à la plage 8 h – 18 h. */
const ligneDe = (minutes: number) =>
  ENTETE + 1 + Math.round((Math.min(Math.max(minutes, DEBUT * 60), FIN * 60) - DEBUT * 60) / (60 / QUARTS_PAR_HEURE));

/** Planning hebdomadaire des salles (lundi – vendredi, 8 h – 18 h) pour le responsable logistique. */
export default function PlanningSemainePage() {
  // Jour choisi (champ date ou boutons) : le planning affiche la semaine qui le contient
  const [jourChoisi, setJourChoisi] = useState(() => new Date());
  const debutSemaine = lundiDe(jourChoisi).getTime();
  const lundi = useMemo(() => new Date(debutSemaine), [debutSemaine]);
  const [salles, setSalles] = useState<Salle[]>([]);
  const [reservations, setReservations] = useState<DemandeSalle[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);

  const jours = Array.from({ length: JOURS }, (_, i) => plusJours(lundi, i));
  const vendredi = jours[JOURS - 1];
  const aujourdhui = new Date();
  const estCetteSemaine = memeJour(lundi, lundiDe(aujourdhui));

  useEffect(() => {
    sallesApi.lister().then(setSalles).catch(() => setSalles([]));
  }, []);

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(null);
    demandesSalleApi
      .semaine(lundi.toISOString(), plusJours(lundi, JOURS).toISOString())
      .then(setReservations)
      .catch((e) => setErreur(messageErreur(e, 'Le planning n’a pas pu être chargé.')))
      .finally(() => setChargement(false));
  }, [lundi]);
  useEffect(charger, [charger]);

  // Salles en service, plus celles hors service qui ont une réservation cette semaine
  const colonnesSalles = salles.filter((s) => s.actif || reservations.some((r) => r.salle.id === s.id));
  const nbSalles = colonnesSalles.length;
  const enAttente = reservations.filter((r) => r.statut === 'EN_ATTENTE_LOGISTIQUE').length;
  /** Colonne de grille d'une salle un jour donné (la colonne 1 porte les heures). */
  const colonneDe = (jour: number, salle: number) => 2 + jour * nbSalles + salle;

  return (
    <AppLayout>
      <div className="semaine">
        <div className="semaine__entete">
          <div>
            <h1 className="semaine__titre">Planning des salles</h1>
            <p className="semaine__intro">
              Semaine du {fmtCourt.format(lundi)} au {fmtAnnee.format(vendredi)}, de {DEBUT}h à {FIN}h
              {!chargement && !erreur && (
                <>
                  {' · '}
                  {reservations.length} réservation{reservations.length > 1 ? 's' : ''}
                  {enAttente > 0 && (
                    <>
                      , dont <Link to="/salles/demandes">{enAttente} en attente de validation</Link>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          <nav className="semaine__navigation" aria-label="Changer de semaine">
            <button
              type="button"
              className="outil"
              aria-pressed={estCetteSemaine}
              onClick={() => setJourChoisi(new Date())}
            >
              Aujourd’hui
            </button>
            <div className="outil-groupe" role="group" aria-label="Semaine précédente ou suivante">
              <button
                type="button"
                className="outil outil--icone outil--precedent"
                onClick={() => setJourChoisi((j) => plusJours(j, -7))}
                aria-label="Semaine précédente"
                title="Semaine précédente"
              >
                <IconChevron taille={18} />
              </button>
              <button
                type="button"
                className="outil outil--icone"
                onClick={() => setJourChoisi((j) => plusJours(j, 7))}
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
                onChange={(e) => e.target.value && setJourChoisi(new Date(`${e.target.value}T00:00:00`))}
              />
            </label>
          </nav>
        </div>

        {erreur && (
          <p className="semaine__message semaine__message--erreur" role="alert">
            {erreur}
          </p>
        )}
        {!erreur && !chargement && nbSalles === 0 && (
          <p className="semaine__message">
            Aucune salle enregistrée. Ajoutez-les dans <Link to="/salles/liste">Liste des salles</Link>.
          </p>
        )}

        {nbSalles > 0 && (
          <div className="semaine__cadre" aria-busy={chargement}>
            <div
              className="grille"
              style={{ '--nb-colonnes': JOURS * nbSalles, '--nb-quarts': HEURES.length * QUARTS_PAR_HEURE } as CSSProperties}
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
                colonnesSalles.map((s, si) => (
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
                    colonnesSalles.map((_, si) => (
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
                {FIN}h
              </span>

              {/* Réservations, placées selon leur créneau */}
              {reservations.map((r) => {
                const ji = jours.findIndex((j) => memeJour(new Date(r.creneauDebut), j));
                const si = colonnesSalles.findIndex((s) => s.id === r.salle.id);
                if (ji < 0 || si < 0) return null;
                const debut = minutesDe(r.creneauDebut);
                const fin = minutesDe(r.creneauFin);
                if (fin <= DEBUT * 60 || debut >= FIN * 60) return null; // hors de la plage affichée
                const court = fin - debut <= 45;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`resa resa--${r.statut === 'EN_ATTENTE_LOGISTIQUE' ? 'attente' : r.statut === 'TERMINEE' ? 'terminee' : 'confirmee'}${court ? ' resa--court' : ''}`}
                    style={{ gridColumn: colonneDe(ji, si), gridRow: `${ligneDe(debut)} / ${ligneDe(fin)}` }}
                    onClick={() => setOuverte(r.id)}
                    title={`${heure(r.creneauDebut)} – ${heure(r.creneauFin)} · ${r.salle.nom}\n${r.objet}\n${r.demandeur.nomComplet} · ${r.nbParticipants} pers. · ${LIBELLE_STATUT[r.statut]}`}
                    aria-label={`${nomDuJour(jours[ji])}, ${r.salle.nom}, ${heure(r.creneauDebut)} à ${heure(r.creneauFin)} : ${r.objet}, ${r.demandeur.nomComplet}, ${LIBELLE_STATUT[r.statut]}. Ouvrir.`}
                  >
                    <span className="resa__heure">
                      {heure(r.creneauDebut)} – {heure(r.creneauFin)}
                    </span>
                    <span className="resa__objet">{r.objet}</span>
                    {!court && <span className="resa__qui">{r.demandeur.nomComplet}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <ul className="semaine__legende" aria-label="Légende">
          <li><span className="resa-puce resa-puce--confirmee" /> Confirmée</li>
          <li><span className="resa-puce resa-puce--attente" /> En attente de validation</li>
          <li><span className="resa-puce resa-puce--terminee" /> Terminée</li>
        </ul>
      </div>

      <Modale ouverte={ouverte !== null} titre="Réservation de salle" onFermer={() => setOuverte(null)} large>
        {ouverte && <DetailDemandeSalle id={ouverte} onModifiee={charger} />}
      </Modale>
    </AppLayout>
  );
}
