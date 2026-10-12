import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import Modale from '@/components/common/Modale';
import { messageErreur } from '@/api/client';
import { demandesSalleApi, sallesApi, type DemandeSalle, type Salle } from '../api';
import { libelleSemaine, useSemaine } from '../semaine';
import DetailDemandeSalle from '../components/DetailDemandeSalle';
import GrilleSemaine, { HEURE_DEBUT, HEURE_FIN } from '../components/GrilleSemaine';
import LienPublic from '../components/LienPublic';
import NavigationSemaine from '../components/NavigationSemaine';
import './PlanningSemainePage.css';

/** Planning hebdomadaire des salles (lundi – vendredi, 8 h – 18 h) pour le responsable logistique. */
export default function PlanningSemainePage() {
  const semaine = useSemaine();
  const { lundi, jours, du, au } = semaine;
  const [salles, setSalles] = useState<Salle[]>([]);
  const [reservations, setReservations] = useState<DemandeSalle[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [lienOuvert, setLienOuvert] = useState(false);

  useEffect(() => {
    sallesApi.lister().then(setSalles).catch(() => setSalles([]));
  }, []);

  const charger = useCallback(() => {
    setChargement(true);
    setErreur(null);
    demandesSalleApi
      .semaine(du, au)
      .then(setReservations)
      .catch((e) => setErreur(messageErreur(e, 'Le planning n’a pas pu être chargé.')))
      .finally(() => setChargement(false));
  }, [du, au]);
  useEffect(charger, [charger]);

  // Salles en service, plus celles hors service qui ont une réservation cette semaine
  const colonnes = salles.filter((s) => s.actif || reservations.some((r) => r.salle.id === s.id));
  const enAttente = reservations.filter((r) => r.statut === 'EN_ATTENTE_LOGISTIQUE').length;

  return (
    <AppLayout>
      <div className="semaine">
        <div className="semaine__entete">
          <div>
            <h1 className="semaine__titre">Planning des salles</h1>
            <p className="semaine__intro">
              {libelleSemaine(lundi)}, de {HEURE_DEBUT}h à {HEURE_FIN}h
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
          <div className="semaine__outils">
            <button type="button" className="outil" onClick={() => setLienOuvert(true)}>
              Lien public · QR code
            </button>
            <NavigationSemaine jourChoisi={semaine.jourChoisi} onChange={semaine.setJourChoisi} estCetteSemaine={semaine.estCetteSemaine} />
          </div>
        </div>

        {erreur && (
          <p className="semaine__message semaine__message--erreur" role="alert">
            {erreur}
          </p>
        )}
        {!erreur && !chargement && colonnes.length === 0 && (
          <p className="semaine__message">
            Aucune salle enregistrée. Ajoutez-les dans <Link to="/salles/liste">Liste des salles</Link>.
          </p>
        )}

        {colonnes.length > 0 && (
          <GrilleSemaine
            salles={colonnes}
            jours={jours}
            chargement={chargement}
            creneaux={reservations.map((r) => ({
              id: r.id,
              salleId: r.salle.id,
              debut: r.creneauDebut,
              fin: r.creneauFin,
              statut: r.statut,
              objet: r.objet,
              sousTitre: `${r.demandeur.nomComplet} · ${r.nbParticipants} pers.`,
            }))}
            onOuvrir={setOuverte}
          />
        )}
      </div>

      <Modale ouverte={ouverte !== null} titre="Réservation de salle" onFermer={() => setOuverte(null)} large>
        {ouverte && <DetailDemandeSalle id={ouverte} onModifiee={charger} />}
      </Modale>
      <Modale ouverte={lienOuvert} titre="Lien public du planning" onFermer={() => setLienOuvert(false)} large>
        <LienPublic />
      </Modale>
    </AppLayout>
  );
}
