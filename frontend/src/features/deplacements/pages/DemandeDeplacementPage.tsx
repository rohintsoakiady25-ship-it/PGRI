import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { messageErreur } from '@/api/client';
import DemandePage, { Champ, Section } from '@/components/demande/DemandePage';
import CarteMadagascar from '@/components/carte/CarteMadagascar';
import ChampLieu from '@/components/carte/ChampLieu';
import { nommerPoint, type Lieu } from '@/components/carte/lieux';
import { calculerItineraires, formaterDuree, type Itineraire } from '@/components/carte/itineraire';
import { demandesDeplacementApi, periode, type TypeDeplacement } from '../api';
import './DemandeDeplacementPage.css';

type Cible = 'depart' | 'destination';
type EtatItineraire = 'attente' | 'calcul' | 'ok' | 'introuvable' | 'erreur';

const km = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/** Nombre de jours calendaires couverts, départ et retour compris (pour pré-remplir la durée d'une mission). */
function joursCouverts(depart: string, retour: string): number | null {
  if (!depart || !retour) return null;
  const jour = (v: string) => new Date(`${v.slice(0, 10)}T00:00:00`).getTime();
  const n = Math.round((jour(retour) - jour(depart)) / 86_400_000) + 1;
  return n >= 1 ? n : null;
}

/** Demande de déplacement (champs : rapport, section 4.1.2). Après l'envoi : « Mes demandes ». */
export default function DemandeDeplacementPage() {
  const [depart, setDepart] = useState<Lieu | null>(null);
  const [destination, setDestination] = useState<Lieu | null>(null);
  const [cible, setCible] = useState<Cible>('destination');
  const [nommage, setNommage] = useState(false);
  const [itineraires, setItineraires] = useState<Itineraire[]>([]);
  const [choix, setChoix] = useState(0);
  const [etat, setEtat] = useState<EtatItineraire>('attente');
  const navigate = useNavigate();
  const [type, setType] = useState<TypeDeplacement>('VILLE');
  const [motif, setMotif] = useState('');
  const [dateDepart, setDateDepart] = useState('');
  const [dateRetour, setDateRetour] = useState('');
  const [duree, setDuree] = useState('');
  const [dureeSaisie, setDureeSaisie] = useState(false);
  const [personnes, setPersonnes] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // Mission : la durée suit les dates tant que le demandeur ne l'a pas modifiée lui-même
  useEffect(() => {
    if (dureeSaisie) return;
    const n = joursCouverts(dateDepart, dateRetour);
    setDuree(n ? String(n) : '');
  }, [dateDepart, dateRetour, dureeSaisie]);

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

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (motif.trim().length < 5) return setErreur('Précisez le motif du déplacement.');
    if (!depart || !destination) return setErreur('Choisissez le lieu de départ et la destination (dans la liste ou sur la carte).');
    if (!dateDepart || !dateRetour) return setErreur('Indiquez la date et l’heure de départ et de retour.');
    if (new Date(dateRetour) <= new Date(dateDepart)) return setErreur('Le retour doit être après le départ.');
    if (type === 'VILLE' && dateDepart.slice(0, 10) !== dateRetour.slice(0, 10)) {
      return setErreur('Un déplacement en ville se fait dans la journée : choisissez « Mission » pour plusieurs jours.');
    }
    if (type === 'MISSION' && !(Number(duree) >= 1)) return setErreur('Indiquez la durée de la mission en jours.');
    setEnvoi(true);
    try {
      const d = await demandesDeplacementApi.soumettre({
        typeDeplacement: type,
        motif,
        lieuDepart: depart.nom,
        departLatitude: depart.lat,
        departLongitude: depart.lon,
        destination: destination.nom,
        destinationLatitude: destination.lat,
        destinationLongitude: destination.lon,
        itineraireRetenu: retenu?.polyline ?? null,
        distanceEstimeeKm: retenu ? Math.round(retenu.distanceKm * 10) / 10 : null,
        dateHeureDepart: new Date(dateDepart).toISOString(),
        dateHeureRetourPrevue: new Date(dateRetour).toISOString(),
        dureeMissionJours: type === 'MISSION' ? Number(duree) : null,
        personnesConcernees: type === 'MISSION' ? personnes.trim() || null : null,
      });
      const suite = d.statut === 'EN_ATTENTE_N1' ? 'Votre supérieur direct va l’examiner.' : 'Le responsable logistique va l’examiner.';
      navigate('/mes-demandes', {
        state: { message: `Demande ${d.reference} envoyée : ${d.lieuDepart} → ${d.destination}, ${periode(d.dateHeureDepart, d.dateHeureRetourPrevue)}. ${suite}` },
      });
    } catch (err) {
      setErreur(messageErreur(err, 'La demande n’a pas pu être envoyée.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <DemandePage
      titre="Demande de déplacement"
      circuit={[
        { titre: 'Votre supérieur direct (N+1)', detail: 'Valide ou refuse la demande.' },
        { titre: 'Responsable logistique', detail: 'Valide et affecte un véhicule et un chauffeur.' },
      ]}
      noteCircuit="L'assistante de direction est informée de votre demande."
      onSoumettre={soumettre}
      envoi={envoi}
      erreur={erreur}
      brouillon={false}
    >
      <Section titre="Type de déplacement">
        <div className="champ champ--large">
          <div className="choix" role="radiogroup" aria-label="Type de déplacement">
            <label className="choix__option">
              <input type="radio" name="typeDeplacement" value="VILLE" checked={type === 'VILLE'} onChange={() => setType('VILLE')} />
              <span className="choix__text">
                <span className="choix__title">Déplacement en ville</span>
                <span className="choix__detail">Aller-retour dans la journée</span>
              </span>
            </label>
            <label className="choix__option">
              <input type="radio" name="typeDeplacement" value="MISSION" id="type-mission" checked={type === 'MISSION'}
                onChange={() => setType('MISSION')} />
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
          <textarea id="motif" name="motif" maxLength={500} placeholder="Ex. réunion avec la direction régionale" value={motif}
            onChange={(e) => setMotif(e.target.value)} />
        </Champ>
        <Champ id="lieuDepart" label="Lieu de départ">
          <ChampLieu id="lieuDepart" name="lieuDepart" valeur={depart} onChange={setDepart} placeholder="Rechercher un lieu" positionActuelle />
        </Champ>
        <Champ id="destination" label="Destination">
          <ChampLieu id="destination" name="destination" valeur={destination} onChange={setDestination} placeholder="Rechercher un lieu" positionActuelle />
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
          <input id="depart" name="dateHeureDepart" type="datetime-local" value={dateDepart} onChange={(e) => setDateDepart(e.target.value)} />
        </Champ>
        <Champ id="retour" label="Date et heure de retour prévues">
          <input id="retour" name="dateHeureRetourPrevue" type="datetime-local" min={dateDepart || undefined} value={dateRetour}
            onChange={(e) => setDateRetour(e.target.value)} />
        </Champ>
      </Section>

      <div className="mission-seulement">
        <Section titre="Mission">
          <Champ id="duree" label="Durée de la mission (jours)">
            <input id="duree" name="dureeMissionJours" type="number" min={1} max={90} value={duree}
              onChange={(e) => {
                setDureeSaisie(true);
                setDuree(e.target.value);
              }} />
          </Champ>
          <div />
          <Champ id="personnes" label="Personnes concernées" optionnel large>
            <textarea id="personnes" name="personnesConcernees" maxLength={2000} placeholder="Une personne par ligne" value={personnes}
              onChange={(e) => setPersonnes(e.target.value)} />
          </Champ>
        </Section>
      </div>
    </DemandePage>
  );
}
