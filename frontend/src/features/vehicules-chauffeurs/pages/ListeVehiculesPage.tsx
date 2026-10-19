import { useMemo, useState } from 'react';
import ListePage from '@/components/liste/ListePage';
import Badge, { type TonBadge } from '@/components/common/Badge';
import Modale from '@/components/common/Modale';
import { useAuth } from '@/auth/AuthContext';
import { peutGererReferentiels } from '@/auth/droits';
import {
  dateCourte, echeance, LIBELLE_DISPONIBILITE, LIBELLE_ECHEANCE, LIBELLE_ETAT, vehiculesApi,
  type Disponibilite, type Echeance, type EtatTechnique, type Vehicule,
} from '../api';
import { normaliser, useListe } from '@/hooks/useListe';
import FormulaireVehicule from '../components/FormulaireVehicule';
import CelluleDisponibilite from '../components/CelluleDisponibilite';
import ConfirmerSuppression from '@/components/common/ConfirmerSuppression';
import './ListeVehiculesPage.css';

const TON_ETAT: Record<EtatTechnique, TonBadge> = { BON: 'succes', A_SURVEILLER: 'attention', EN_REPARATION: 'danger' };
const TON_ECHEANCE: Record<Echeance, TonBadge> = { EXPIREE: 'danger', BIENTOT: 'attention', VALIDE: 'succes', NON_RENSEIGNEE: 'neutre' };
const aSurveiller = (fin: string | null) => ['EXPIREE', 'BIENTOT'].includes(echeance(fin));

/** Assurance ou visite technique : état de l'échéance et date de fin. */
function CelluleEcheance({ debut, fin }: { debut: string | null; fin: string | null }) {
  const e = echeance(fin);
  return (
    <span className="echeance" title={debut && fin ? `Du ${dateCourte(debut)} au ${dateCourte(fin)}` : undefined}>
      <Badge ton={TON_ECHEANCE[e]}>{LIBELLE_ECHEANCE[e]}</Badge>
      {fin && <span className="liste__discret">jusqu’au {dateCourte(fin)}</span>}
      {!fin && debut && <span className="liste__discret">depuis le {dateCourte(debut)}</span>}
    </span>
  );
}

/** Liste des voitures (entité Vehicule, Figure 3). */
export default function ListeVehiculesPage() {
  const { utilisateur } = useAuth();
  const gestion = peutGererReferentiels(utilisateur);
  const { elements, chargement, erreur, recharger } = useListe(vehiculesApi.lister);
  const [recherche, setRecherche] = useState('');
  const [etat, setEtat] = useState('');
  const [dispo, setDispo] = useState('');
  const [echeances, setEcheances] = useState('');
  const [edition, setEdition] = useState<Vehicule | 'nouveau' | null>(null);
  const [aSupprimer, setASupprimer] = useState<Vehicule | null>(null);

  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return elements.filter(
      (v) =>
        (!q || normaliser(`${v.immatriculation} ${v.marqueModele ?? ''}`).includes(q)) &&
        (!etat || v.etatTechnique === etat) &&
        (!dispo || v.disponibilite === dispo) &&
        (!echeances ||
          (echeances === 'ASSURANCE' && aSurveiller(v.assuranceFin)) ||
          (echeances === 'VISITE' && aSurveiller(v.visiteTechniqueFin)) ||
          (echeances === 'MANQUANTE' && (!v.assuranceFin || !v.visiteTechniqueFin))),
    );
  }, [elements, recherche, etat, dispo, echeances]);

  const colonnes = [
    { label: 'Immatriculation' },
    { label: 'Modèle' },
    { label: 'Assurance' },
    { label: 'Visite technique' },
    { label: 'État technique' },
    { label: 'Disponibilité' },
    ...(gestion ? [{ label: 'Actions', sr: true }] : []),
  ];

  return (
    <>
      <ListePage
        titre="Liste des voitures"
        placeholderRecherche="Rechercher par immatriculation ou modèle"
        recherche={recherche}
        onRecherche={setRecherche}
        filtres={[
          { id: 'etat', label: 'État technique', valeur: etat, onChange: setEtat,
            options: (Object.keys(LIBELLE_ETAT) as EtatTechnique[]).map((k) => ({ valeur: k, libelle: LIBELLE_ETAT[k] })) },
          { id: 'dispo', label: 'Disponibilité', valeur: dispo, onChange: setDispo,
            options: (Object.keys(LIBELLE_DISPONIBILITE) as Disponibilite[]).map((k) => ({ valeur: k, libelle: LIBELLE_DISPONIBILITE[k] })) },
          { id: 'echeances', label: 'Échéances', valeur: echeances, onChange: setEcheances,
            options: [
              { valeur: 'ASSURANCE', libelle: 'Assurance expirée ou à renouveler' },
              { valeur: 'VISITE', libelle: 'Visite expirée ou à renouveler' },
              { valeur: 'MANQUANTE', libelle: 'Dates manquantes' },
            ] },
        ]}
        colonnes={colonnes}
        lignes={visibles.map((v) => ({
          cle: v.id,
          attenuee: !v.actif,
          cellules: [
            <strong key="i">{v.immatriculation}</strong>,
            <span key="m" className="liste__empile">
              {v.marqueModele ?? '—'}
              {v.nbPlaces && <span className="liste__discret">{v.nbPlaces} places</span>}
            </span>,
            <CelluleEcheance key="as" debut={v.assuranceDebut} fin={v.assuranceFin} />,
            <CelluleEcheance key="vt" debut={v.visiteTechniqueDebut} fin={v.visiteTechniqueFin} />,
            <Badge key="e" ton={TON_ETAT[v.etatTechnique]}>{LIBELLE_ETAT[v.etatTechnique]}</Badge>,
            <CelluleDisponibilite key="d" disponibilite={v.disponibilite} motif={v.motif} mission={v.mission} prochaineMission={v.prochaineMission} />,
            ...(gestion
              ? [
                  <span key="a" className="liste__actions-ligne">
                    <button type="button" className="btn btn--petit" onClick={() => setEdition(v)}
                      aria-label={`Modifier le véhicule ${v.immatriculation}`}>
                      Modifier
                    </button>
                    <button type="button" className="btn btn--petit btn--petit-danger" onClick={() => setASupprimer(v)}
                      aria-label={`Supprimer le véhicule ${v.immatriculation}`}>
                      Supprimer
                    </button>
                  </span>,
                ]
              : []),
          ],
        }))}
        chargement={chargement}
        erreur={erreur}
        total={elements.length}
        messageVide={gestion ? 'Aucune voiture enregistrée. Ajoutez-en une avec le bouton « Ajouter une voiture ».' : 'Aucune voiture enregistrée pour le moment.'}
        action={
          gestion && (
            <button type="button" className="btn btn--primary" onClick={() => setEdition('nouveau')}>
              + Ajouter une voiture
            </button>
          )
        }
      />
      <Modale
        ouverte={edition !== null}
        titre={edition === 'nouveau' ? 'Ajouter une voiture' : `Modifier ${edition ? edition.immatriculation : ''}`}
        onFermer={() => setEdition(null)}
      >
        <FormulaireVehicule
          vehicule={edition === 'nouveau' ? null : edition}
          onAnnuler={() => setEdition(null)}
          onEnregistre={() => {
            setEdition(null);
            recharger();
          }}
        />
      </Modale>
      <Modale ouverte={aSupprimer !== null} titre="Supprimer le véhicule ?" onFermer={() => setASupprimer(null)}>
        {aSupprimer && (
          <ConfirmerSuppression
            nom={aSupprimer.immatriculation}
            supprimer={() => vehiculesApi.supprimer(aSupprimer.id)}
            onAnnuler={() => setASupprimer(null)}
            onSupprime={() => {
              setASupprimer(null);
              recharger();
            }}
          />
        )}
      </Modale>
    </>
  );
}
