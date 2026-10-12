import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import logoMnp from '@/assets/logo-mnp.png';
import BoutonTheme from '@/theme/BoutonTheme';
import { messageErreur } from '@/api/client';
import { planningPublicApi, type PlanningPublic } from '../api';
import { libelleSemaine, useSemaine } from '../semaine';
import GrilleSemaine, { HEURE_DEBUT, HEURE_FIN } from '../components/GrilleSemaine';
import NavigationSemaine from '../components/NavigationSemaine';
import './PlanningPublicPage.css';

const ACTUALISATION = 2 * 60 * 1000; // l'écran affiché près des salles se met à jour seul
const fmtHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Planning des salles en lecture seule, sans connexion : ouvert par le lien public ou son QR code. */
export default function PlanningPublicPage() {
  const { jeton = '' } = useParams();
  const semaine = useSemaine();
  const { lundi, jours, du, au } = semaine;
  const [donnees, setDonnees] = useState<PlanningPublic | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lienInvalide, setLienInvalide] = useState(false);
  const [majA, setMajA] = useState<Date | null>(null);

  const charger = useCallback(() => {
    setChargement(true);
    planningPublicApi(jeton, du, au)
      .then((d) => {
        setDonnees(d);
        setErreur(null);
        setLienInvalide(false);
        setMajA(new Date());
      })
      .catch((e) => {
        if (axios.isAxiosError(e) && e.response?.status === 404) setLienInvalide(true);
        else setErreur(messageErreur(e, 'Le planning n’a pas pu être chargé.'));
      })
      .finally(() => setChargement(false));
  }, [jeton, du, au]);

  useEffect(() => {
    charger();
    const t = setInterval(charger, ACTUALISATION);
    const auRetour = () => document.visibilityState === 'visible' && charger();
    document.addEventListener('visibilitychange', auRetour);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', auRetour);
    };
  }, [charger]);

  return (
    <div className="public">
      <header className="public__bandeau">
        <img src={logoMnp} alt="Madagascar National Parks" className="public__logo" />
        <div className="public__marque">
          <strong>Planning des salles de réunion</strong>
          <span>Madagascar National Parks</span>
        </div>
        <BoutonTheme />
      </header>

      <main className="public__contenu">
        {lienInvalide ? (
          <div className="public__invalide" role="alert">
            <h1>Ce lien n’est plus valide</h1>
            <p>Le QR code a été renouvelé. Demandez le nouveau au responsable logistique.</p>
          </div>
        ) : (
          <>
            <div className="public__entete">
              <div>
                <h1 className="public__titre">{libelleSemaine(lundi)}</h1>
                <p className="public__intro">
                  De {HEURE_DEBUT}h à {HEURE_FIN}h
                  {donnees && ` · ${donnees.reservations.length} réservation${donnees.reservations.length > 1 ? 's' : ''} confirmée${donnees.reservations.length > 1 ? 's' : ''}`}
                </p>
              </div>
              <NavigationSemaine jourChoisi={semaine.jourChoisi} onChange={semaine.setJourChoisi} estCetteSemaine={semaine.estCetteSemaine} />
            </div>

            {erreur && (
              <p className="public__erreur" role="alert">
                {erreur}
              </p>
            )}
            {donnees && donnees.salles.length > 0 && (
              <GrilleSemaine
                salles={donnees.salles}
                jours={jours}
                chargement={chargement}
                creneaux={donnees.reservations}
                avecAttente={false}
              />
            )}
            {donnees && donnees.salles.length === 0 && <p className="public__intro">Aucune salle n’est encore enregistrée.</p>}
            {majA && (
              <p className="public__maj">
                Mis à jour à {fmtHeure.format(majA).replace(':', 'h')} · actualisation automatique toutes les 2 minutes
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
