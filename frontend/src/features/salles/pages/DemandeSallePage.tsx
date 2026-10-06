import DemandePage, { Champ, Section } from '@/components/demande/DemandePage';
import './DemandeSallePage.css';

const HEURES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
// Liste indicative : à remplacer par les équipements réels de la Salle 1 et de la Salle 2.
const EQUIPEMENTS = ['Vidéoprojecteur', 'Écran', 'Visioconférence', 'Tableau blanc'];

/** Réservation de salle — maquette statique (champs : rapport, section 4.1.3). */
export default function DemandeSallePage() {
  return (
    <DemandePage
      titre="Réservation de salle"
      intro="Choisissez une salle et un créneau libres. En cas de conflit, une autre salle ou un autre créneau vous sera proposé."
      circuit={[{ titre: 'Responsable logistique', detail: 'Valide ou refuse la réservation.' }]}
      noteCircuit="Votre N+1 et l'assistante de direction peuvent consulter la demande et la commenter."
    >
      <Section titre="Disponibilités">
        <div className="champ champ--large">
          <div className="planning" role="table" aria-label="Disponibilités des salles">
            <div className="planning__row planning__row--head" role="row">
              <span role="columnheader" />
              {HEURES.map((h) => (
                <span key={h} className="planning__hour" role="columnheader">
                  {h}h
                </span>
              ))}
            </div>
            {['Salle 1', 'Salle 2'].map((salle) => (
              <div key={salle} className="planning__row" role="row">
                <span className="planning__salle" role="rowheader">
                  {salle}
                </span>
                {HEURES.map((h) => (
                  <span key={h} className="planning__slot" role="cell" aria-label={`${salle}, ${h}h : libre`} />
                ))}
              </div>
            ))}
          </div>
          <p className="champ__aide">Les créneaux réservés apparaîtront ici pour la date choisie.</p>
        </div>
      </Section>

      <Section titre="Salle et créneau">
        <div className="champ champ--large">
          <div className="choix" role="radiogroup" aria-label="Salle">
            <label className="choix__option">
              <input type="radio" name="salle" value="SALLE_1" defaultChecked />
              <span className="choix__text">
                <span className="choix__title">Salle 1</span>
              </span>
            </label>
            <label className="choix__option">
              <input type="radio" name="salle" value="SALLE_2" />
              <span className="choix__text">
                <span className="choix__title">Salle 2</span>
              </span>
            </label>
          </div>
        </div>
        <Champ id="date" label="Date" large>
          <input id="date" name="date" type="date" />
        </Champ>
        <Champ id="debut" label="Heure de début">
          <input id="debut" name="creneauDebut" type="time" step={900} />
        </Champ>
        <Champ id="fin" label="Heure de fin">
          <input id="fin" name="creneauFin" type="time" step={900} />
        </Champ>
      </Section>

      <Section titre="Réunion">
        <Champ id="objet" label="Objet de la réunion" large>
          <input id="objet" name="objet" type="text" />
        </Champ>
        <Champ id="nbParticipants" label="Nombre de participants">
          <input id="nbParticipants" name="nbParticipants" type="number" min={1} />
        </Champ>
        <div />
        <div className="champ champ--large">
          <span className="champ__label">Équipements souhaités</span>
          <ul className="cases">
            {EQUIPEMENTS.map((e) => (
              <li key={e}>
                <label>
                  <input type="checkbox" name="equipementsSouhaites" value={e} />
                  {e}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <Champ id="participants" label="Participants" optionnel large>
          <textarea id="participants" name="participants" placeholder="Une personne par ligne" />
        </Champ>
      </Section>
    </DemandePage>
  );
}
