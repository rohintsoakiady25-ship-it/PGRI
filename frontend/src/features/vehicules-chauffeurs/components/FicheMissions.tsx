import { useEffect, useState } from 'react';
import Badge, { type TonBadge } from '@/components/common/Badge';
import { messageErreur } from '@/api/client';
import { periode } from '@/features/deplacements/api';
import { dateHeure } from '@/features/salles/api';
import type { MissionFiche, MissionsFiche } from '../api';
import './FicheMissions.css';

const LIBELLE_STATUT: Record<MissionFiche['statut'], string> = {
  PREVUE: 'Prévue',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  ANNULEE: 'Annulée',
};
const TON_STATUT: Record<MissionFiche['statut'], TonBadge> = { PREVUE: 'attention', EN_COURS: 'succes', TERMINEE: 'neutre', ANNULEE: 'neutre' };

interface Props {
  /** Fiche d'un véhicule (on affiche le chauffeur de chaque mission) ou d'un chauffeur (on affiche le véhicule). */
  cible: 'vehicule' | 'chauffeur';
  charger: () => Promise<MissionsFiche>;
}

/** Missions à venir et historique des déplacements d'un véhicule ou d'un chauffeur. */
export default function FicheMissions({ cible, charger }: Props) {
  const [missions, setMissions] = useState<MissionsFiche | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    charger().then(setMissions).catch((e) => setErreur(messageErreur(e, 'Les missions n’ont pas pu être chargées.')));
  }, [charger]);

  if (!missions) return <p className="fiche__vide">{erreur ?? 'Chargement…'}</p>;

  const carte = (m: MissionFiche) => (
    <li key={m.id} className="fiche__mission">
      <div className="fiche__entete">
        <strong>{periode(m.debut, m.fin)}</strong>
        <Badge ton={TON_STATUT[m.statut]}>{LIBELLE_STATUT[m.statut]}</Badge>
      </div>
      <p className="fiche__ligne">
        {cible === 'vehicule' ? (
          <>
            Chauffeur : {m.chauffeur.nomComplet}
            {m.chauffeur.telephone && <span className="fiche__discret"> · {m.chauffeur.telephone}</span>}
          </>
        ) : (
          <>
            Véhicule : {m.vehicule.immatriculation}
            {m.vehicule.marqueModele && <span className="fiche__discret"> · {m.vehicule.marqueModele}</span>}
          </>
        )}
      </p>
      <ul className="fiche__demandes">
        {m.demandes.map((d) => (
          <li key={d.id}>
            <span className="fiche__reference">{d.reference}</span> {d.lieuDepart} → {d.destination}
            <span className="fiche__discret">
              {' '}
              · {d.demandeur} · {d.motif}
            </span>
          </li>
        ))}
      </ul>
      {(m.heureDepartReelle || m.heureRetourReelle) && (
        <p className="fiche__ligne fiche__discret">
          {m.heureDepartReelle && `Parti le ${dateHeure(m.heureDepartReelle)}`}
          {m.heureDepartReelle && m.heureRetourReelle && ' · '}
          {m.heureRetourReelle && `revenu le ${dateHeure(m.heureRetourReelle)}`}
        </p>
      )}
      {m.incidents && <p className="fiche__incident">Incidents : {m.incidents}</p>}
    </li>
  );

  return (
    <div className="fiche">
      <section aria-labelledby="fiche-avenir">
        <h3 id="fiche-avenir" className="fiche__titre">
          Prochaines affectations <span className="fiche__discret">({missions.aVenir.length})</span>
        </h3>
        {missions.aVenir.length ? <ol className="fiche__liste">{missions.aVenir.map(carte)}</ol> : <p className="fiche__vide">Aucune mission prévue.</p>}
      </section>
      <section aria-labelledby="fiche-historique">
        <h3 id="fiche-historique" className="fiche__titre">
          Historique des déplacements <span className="fiche__discret">({missions.historique.length})</span>
        </h3>
        {missions.historique.length ? (
          <ol className="fiche__liste">{missions.historique.map(carte)}</ol>
        ) : (
          <p className="fiche__vide">Aucun déplacement effectué pour l’instant.</p>
        )}
      </section>
    </div>
  );
}
