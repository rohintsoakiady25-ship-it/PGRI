import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import DemandePage, { Champ, Section } from '@/components/demande/DemandePage';
import { messageErreur } from '@/api/client';
import {
  creneau, demandesSalleApi, heure, hhmmDe, minutesDe, sallesApi, versIso, type Disponibilite, type Occupation, type Salle,
} from '../api';
import PlanningSalles, { FERMETURE, OUVERTURE } from '../components/PlanningSalles';
import './DemandeSallePage.css';

const aujourdhui = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const enMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Réservation de salle (section 4.1.3) : planning du jour, contrôle des conflits et proposition d'alternative. */
export default function DemandeSallePage() {
  const navigate = useNavigate();
  const [salles, setSalles] = useState<Salle[]>([]);
  const [jour, setJour] = useState(aujourdhui);
  const [debut, setDebut] = useState('09:00');
  const [fin, setFin] = useState('10:00');
  const [salleId, setSalleId] = useState('');
  const [objet, setObjet] = useState('');
  const [nbParticipants, setNbParticipants] = useState('');
  const [equipements, setEquipements] = useState<string[]>([]);
  const [participants, setParticipants] = useState('');
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [dispo, setDispo] = useState<Disponibilite | null>(null);
  const [dispoErreur, setDispoErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Salles en service
  useEffect(() => {
    sallesApi
      .disponibles()
      .then((s) => {
        setSalles(s);
        setSalleId((id) => id || s[0]?.id || '');
      })
      .catch((e) => setChargement(messageErreur(e, 'Les salles n’ont pas pu être chargées.')));
  }, []);

  // Planning de la journée choisie
  useEffect(() => {
    if (!jour) return;
    demandesSalleApi
      .planning(versIso(jour, '00:00'), versIso(jour, '23:59'))
      .then(setOccupations)
      .catch(() => setOccupations([]));
  }, [jour]);

  // Contrôle du créneau et des conflits, à chaque modification (après une courte pause de saisie)
  const nb = Number(nbParticipants) || undefined;
  useEffect(() => {
    setDispo(null);
    setDispoErreur(null);
    if (!jour || !debut || !fin || !salleId) return;
    const t = setTimeout(() => {
      demandesSalleApi
        .disponibilite({ salleId, debut: versIso(jour, debut), fin: versIso(jour, fin), nbParticipants: nb })
        .then(setDispo)
        .catch((e) => setDispoErreur(messageErreur(e, 'Le créneau n’a pas pu être vérifié.')));
    }, 300);
    return () => clearTimeout(t);
  }, [jour, debut, fin, salleId, nb]);

  const salle = salles.find((s) => s.id === salleId);
  const etat = dispo?.salles.find((x) => x.salle.id === salleId);
  // Seuls les équipements de la salle choisie peuvent être demandés, avec le nombre d'appareils libres sur le créneau
  const materiel = etat?.materiel ?? (salle?.equipements ?? []).map((nom) => ({ nom, total: 0, libres: -1 }));
  const alternatives = dispo?.salles.filter((x) => x.salle.id !== salleId && x.libre && x.capaciteSuffisante) ?? [];

  // Changement de salle ou de créneau : on retire le matériel absent de la salle ou sans appareil libre
  useEffect(() => {
    const dispo = salles.find((s) => s.id === salleId)?.equipements ?? [];
    const sansAppareil = new Set((etat?.materiel ?? []).filter((m) => m.libres === 0).map((m) => m.nom));
    setEquipements((l) => l.filter((e) => dispo.includes(e) && !sansAppareil.has(e)));
  }, [salleId, salles, etat]);

  function choisirDansPlanning(id: string, minutes: number) {
    const duree = Math.max(enMinutes(fin) - enMinutes(debut), 30);
    const depart = Math.min(minutes, FERMETURE - duree);
    setSalleId(id);
    setDebut(hhmmDe(Math.max(depart, OUVERTURE)));
    setFin(hhmmDe(Math.max(depart, OUVERTURE) + duree));
  }

  function prendreCreneau(iso: { debut: string; fin: string }) {
    setDebut(hhmmDe(minutesDe(iso.debut)));
    setFin(hhmmDe(minutesDe(iso.fin)));
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const d = await demandesSalleApi.soumettre({
        salleId,
        debut: versIso(jour, debut),
        fin: versIso(jour, fin),
        objet,
        nbParticipants: Number(nbParticipants),
        equipementsSouhaites: equipements,
        participants: participants.trim() || null,
      });
      navigate('/mes-demandes', {
        state: { message: `Réservation ${d.reference} envoyée : ${d.salle.nom}, ${creneau(d.creneauDebut, d.creneauFin)}. Le responsable logistique va l’examiner.` },
      });
    } catch (err) {
      setErreur(messageErreur(err, "La réservation n'a pas pu être envoyée."));
      setEnvoi(false);
    }
  }

  return (
    <DemandePage
      titre="Réservation de salle"
      intro="Choisissez une salle et un créneau libres. En cas de conflit, une autre salle ou un autre créneau vous est proposé."
      circuit={[{ titre: 'Responsable logistique', detail: 'Valide ou refuse la réservation.' }]}
      noteCircuit="Votre N+1 et l'assistante de direction peuvent consulter la demande et la commenter."
      onSoumettre={soumettre}
      envoi={envoi}
      erreur={erreur}
      brouillon={false}
    >
      <Section titre="Disponibilités">
        <Champ id="jour" label="Date" aide="Cliquez sur une heure du planning pour y placer votre créneau.">
          <input id="jour" type="date" value={jour} min={aujourdhui()} required onChange={(e) => setJour(e.target.value)} />
        </Champ>
        <div />
        <div className="champ champ--large">
          {chargement ? (
            <p className="champ__aide" role="alert">{chargement}</p>
          ) : salles.length === 0 ? (
            <p className="champ__aide">Aucune salle n’est encore enregistrée. Le responsable logistique doit d’abord les ajouter.</p>
          ) : (
            <PlanningSalles
              salles={salles}
              occupations={occupations}
              selection={salleId ? { salleId, debut: enMinutes(debut), fin: enMinutes(fin) } : null}
              onChoisir={choisirDansPlanning}
            />
          )}
        </div>
      </Section>

      <Section titre="Salle et créneau">
        <div className="champ champ--large">
          <div className="choix" role="radiogroup" aria-label="Salle">
            {salles.map((s) => {
              const e = dispo?.salles.find((x) => x.salle.id === s.id);
              return (
                <label key={s.id} className="choix__option">
                  <input type="radio" name="salle" value={s.id} checked={salleId === s.id} onChange={() => setSalleId(s.id)} />
                  <span className="choix__text">
                    <span className="choix__title">
                      {s.nom}
                      {e && !e.libre && <span className="salle__etat salle__etat--prise">Occupée</span>}
                      {e && e.libre && !e.capaciteSuffisante && <span className="salle__etat salle__etat--petite">Trop petite</span>}
                      {e && e.libre && e.capaciteSuffisante && <span className="salle__etat salle__etat--libre">Libre</span>}
                    </span>
                    <span className="choix__detail">
                      {s.capacite} places{s.equipements.length > 0 && ` · ${s.equipements.join(', ')}`}
                      {s.localisation && ` · ${s.localisation}`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <Champ id="debut" label="Heure de début">
          <input id="debut" type="time" step={900} min="07:00" max="18:45" required value={debut} onChange={(e) => setDebut(e.target.value)} />
        </Champ>
        <Champ id="fin" label="Heure de fin">
          <input id="fin" type="time" step={900} min="07:15" max="19:00" required value={fin} onChange={(e) => setFin(e.target.value)} />
        </Champ>

        <div className="champ champ--large" aria-live="polite">
          {dispoErreur && <p className="verif verif--erreur">{dispoErreur}</p>}
          {etat?.libre && etat.capaciteSuffisante && salle && (
            <p className="verif verif--ok">
              {salle.nom} est libre {creneau(versIso(jour, debut), versIso(jour, fin))}.
            </p>
          )}
          {etat && !etat.libre && salle && (
            <div className="verif verif--conflit">
              <p>
                <strong>{salle.nom}</strong> est déjà réservée{' '}
                {etat.conflits.map((c) => `de ${heure(c.debut)} à ${heure(c.fin)}`).join(', ')}.
              </p>
              {(alternatives.length > 0 || dispo?.autreCreneau) && (
                <div className="verif__alternatives">
                  <span>Nous vous proposons :</span>
                  {alternatives.map((a) => (
                    <button key={a.salle.id} type="button" className="btn btn--petit" onClick={() => setSalleId(a.salle.id)}>
                      {a.salle.nom}, même horaire
                    </button>
                  ))}
                  {dispo?.autreCreneau && (
                    <button type="button" className="btn btn--petit" onClick={() => prendreCreneau(dispo.autreCreneau!)}>
                      {salle.nom}, de {heure(dispo.autreCreneau.debut)} à {heure(dispo.autreCreneau.fin)}
                    </button>
                  )}
                </div>
              )}
              {alternatives.length === 0 && !dispo?.autreCreneau && <p>Aucune autre salle ni aucun autre créneau n’est libre ce jour-là.</p>}
            </div>
          )}
          {etat?.libre && !etat.capaciteSuffisante && salle && (
            <p className="verif verif--conflit">
              {salle.nom} n’a que {salle.capacite} places pour {nbParticipants} participants.
              {alternatives.length > 0 && ` Salle assez grande et libre : ${alternatives.map((a) => a.salle.nom).join(', ')}.`}
            </p>
          )}
        </div>
      </Section>

      <Section titre="Réunion">
        <Champ id="objet" label="Objet de la réunion" large>
          <input id="objet" type="text" required maxLength={200} value={objet} onChange={(e) => setObjet(e.target.value)} />
        </Champ>
        <Champ id="nbParticipants" label="Nombre de participants">
          <input id="nbParticipants" type="number" min={1} max={500} required value={nbParticipants} onChange={(e) => setNbParticipants(e.target.value)} />
        </Champ>
        <div />
        {salle && (
          <div className="champ champ--large">
            <span className="champ__label">Équipements souhaités <span className="champ__optional">({salle.nom})</span></span>
            {materiel.length === 0 ? (
              <p className="champ__aide">Aucun équipement n’est enregistré pour {salle.nom}.</p>
            ) : (
              <p className="champ__aide">L’appareil précis (par exemple VP-01) est attribué par la logistique à la confirmation.</p>
            )}
            <ul className="cases">
              {materiel.map(({ nom: eq, libres }) => (
                <li key={eq}>
                  <label className={libres === 0 ? 'cases__indisponible' : undefined}>
                    <input
                      type="checkbox"
                      disabled={libres === 0}
                      checked={equipements.includes(eq)}
                      onChange={(e) => setEquipements((l) => (e.target.checked ? [...l, eq] : l.filter((x) => x !== eq)))}
                    />
                    {eq}
                    {libres === 0 && <span className="cases__note">tous déjà attribués sur ce créneau</span>}
                    {libres > 1 && <span className="cases__note">{libres} disponibles</span>}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Champ id="participants" label="Participants" optionnel large>
          <textarea id="participants" maxLength={2000} placeholder="Une personne par ligne" value={participants} onChange={(e) => setParticipants(e.target.value)} />
        </Champ>
      </Section>
    </DemandePage>
  );
}
