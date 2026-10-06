import { useEffect, useState } from 'react';
import DemandePage, { Champ, Section } from '@/components/demande/DemandePage';
import CarteMadagascar from '@/components/carte/CarteMadagascar';
import ChampLieu from '@/components/carte/ChampLieu';
import { nommerPoint, type Lieu } from '@/components/carte/lieux';
import { calculerItineraires, formaterDuree, type Itineraire } from '@/components/carte/itineraire';
import './DemandeDeplacementPage.css';

type Cible = 'depart' | 'destination';
type EtatItineraire = 'attente' | 'calcul' | 'ok' | 'introuvable' | 'erreur';

const km = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/** Demande de déplacement (champs : rapport, section 4.1.2). Envoi non branché. */
export default function DemandeDeplacementPage() {
  const [depart, setDepart] = useState<Lieu | null>(null);
  const [destination, setDestination] = useState<Lieu | null>(null);
  const [cible, setCible] = useState<Cible>('destination');
  const [nommage, setNommage] = useState(false);
  const [itineraires, setItineraires] = useState<Itineraire[]>([]);
  const [choix, setChoix] = useState(0);
  const [etat, setEtat] = useState<EtatItineraire>('attente');

  // Itinéraires routiers dès que le départ et la destination sont connus
  useEffect(() => {
    setItineraires([]);
    setChoix(0);
    if (!depart || !destination) {
      setEtat('attente');
      return;
    }
    const annulation = new AbortController();
    setEtat('calcul');
    calculerItineraires(depart, destination, annulation.signal)
      .then((resultats) => {
        setItineraires(resultats);
        setEtat(resultats.length ? 'ok' : 'introuvable');
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setEtat('erreur');
      });
    return () => annulation.abort();
  }, [depart, destination]);

  const retenu = itineraires[choix];

  async function placerSurCarte(lon: number, lat: number) {
    const definir = cible === 'depart' ? setDepart : setDestination;
    setNommage(true);
    definir(await nommerPoint(lon, lat));
    setNommage(false);
  }

  return (
    <DemandePage
      titre="Demande de déplacement"
      intro="Décrivez votre besoin. Le véhicule et le chauffeur sont choisis par le responsable logistique après validation."
      circuit={[
        { titre: 'Votre supérieur direct (N+1)', detail: 'Valide ou refuse la demande.' },
        { titre: 'Responsable logistique', detail: 'Valide et affecte un véhicule et un chauffeur.' },
      ]}
      noteCircuit="L'assistante de direction est informée de votre demande."
    >
      <Section titre="Type de déplacement">
        <div className="champ champ--large">
          <div className="choix" role="radiogroup" aria-label="Type de déplacement">
            <label className="choix__option">
              <input type="radio" name="typeDeplacement" value="VILLE" defaultChecked />
              <span className="choix__text">
                <span className="choix__title">Déplacement en ville</span>
                <span className="choix__detail">Aller-retour dans la journée</span>
              </span>
            </label>
            <label className="choix__option">
              <input type="radio" name="typeDeplacement" value="MISSION" id="type-mission" />
              <span className="choix__text">
                <span className="choix__title">Mission (province)</span>
                <span className="choix__detail">Sur plusieurs jours</span>
              </span>
            </label>
          </div>
        </div>
      </Section>

      <Section titre="Trajet">
        <Champ id="motif" label="Motif du déplacement" large>
          <textarea id="motif" name="motif" placeholder="Ex. réunion avec la direction régionale" />
        </Champ>
        <Champ id="lieuDepart" label="Lieu de départ">
          <ChampLieu id="lieuDepart" name="lieuDepart" valeur={depart} onChange={setDepart} placeholder="Rechercher un lieu" />
        </Champ>
        <Champ id="destination" label="Destination">
          <ChampLieu id="destination" name="destination" valeur={destination} onChange={setDestination} placeholder="Rechercher un lieu" />
        </Champ>

        <div className="champ champ--large">
          <div className="carte-barre">
            <span className="carte-barre__label" id="cible-label">Un clic sur la carte place :</span>
            <div className="segment" role="radiogroup" aria-labelledby="cible-label">
              {(['destination', 'depart'] as Cible[]).map((c) => (
                <label key={c} className="segment__option">
                  <input type="radio" name="cibleCarte" checked={cible === c} onChange={() => setCible(c)} />
                  {c === 'destination' ? 'la destination' : 'le départ'}
                </label>
              ))}
            </div>
            {nommage && <span className="carte-barre__etat">Recherche du nom du lieu…</span>}
          </div>

          <CarteMadagascar
            hauteur={420}
            depart={depart}
            destination={destination}
            itineraires={itineraires}
            itineraireChoisi={choix}
            onSelection={placerSurCarte}
            onChoixItineraire={setChoix}
          />

          <div className="trajet" aria-live="polite">
            {etat === 'attente' && (
              <p className="trajet__message">Choisissez le lieu de départ et la destination pour calculer l'itinéraire.</p>
            )}
            {etat === 'calcul' && <p className="trajet__message">Calcul de l'itinéraire par la route…</p>}
            {etat === 'introuvable' && (
              <p className="trajet__message trajet__message--alerte">
                Aucun itinéraire routier trouvé entre ces deux lieux. Vérifiez qu'ils sont accessibles par la route.
              </p>
            )}
            {etat === 'erreur' && (
              <p className="trajet__message trajet__message--alerte">
                Le calcul d'itinéraire est indisponible pour le moment. Réessayez dans quelques instants.
              </p>
            )}
            {etat === 'ok' && retenu && (
              <>
                <p className="trajet__resume">
                  <span className="trajet__distance">{km(retenu.distanceKm)} km</span>
                  <span className="trajet__detail">
                    par la route · environ {formaterDuree(retenu.dureeMin)} de trajet
                  </span>
                </p>
                <p className="trajet__source">
                  Calcul sur les routes d'OpenStreetMap ; la distance sera vérifiée par la logistique.
                </p>
                {itineraires.length > 1 && (
                  <fieldset className="itineraires">
                    <legend className="itineraires__titre">Itinéraires proposés</legend>
                    {itineraires.map((it, i) => (
                      <label key={i} className="itineraires__option">
                        <input type="radio" name="itineraireChoisi" checked={i === choix} onChange={() => setChoix(i)} />
                        <span className="itineraires__nom">Itinéraire {i + 1}</span>
                        <span className="itineraires__valeurs">
                          {km(it.distanceKm)} km · {formaterDuree(it.dureeMin)}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
              </>
            )}
          </div>

          {/* Coordonnées, itinéraire retenu et distance transmis avec le formulaire */}
          <input type="hidden" name="departLatitude" value={depart?.lat ?? ''} />
          <input type="hidden" name="departLongitude" value={depart?.lon ?? ''} />
          <input type="hidden" name="destinationLatitude" value={destination?.lat ?? ''} />
          <input type="hidden" name="destinationLongitude" value={destination?.lon ?? ''} />
          <input type="hidden" name="distanceEstimeeKm" value={retenu?.distanceKm ?? ''} />
          <input type="hidden" name="itineraireRetenu" value={retenu?.polyline ?? ''} />
        </div>
      </Section>

      <Section titre="Dates">
        <Champ id="depart" label="Date et heure de départ">
          <input id="depart" name="dateHeureDepart" type="datetime-local" />
        </Champ>
        <Champ id="retour" label="Date et heure de retour prévues">
          <input id="retour" name="dateHeureRetourPrevue" type="datetime-local" />
        </Champ>
      </Section>

      <div className="mission-seulement">
        <Section titre="Mission">
          <Champ id="duree" label="Durée de la mission (jours)">
            <input id="duree" name="dureeMissionJours" type="number" min={1} />
          </Champ>
          <div />
          <Champ id="personnes" label="Personnes concernées" optionnel large>
            <textarea id="personnes" name="personnesConcernees" placeholder="Une personne par ligne" />
          </Champ>
        </Section>
      </div>
    </DemandePage>
  );
}
