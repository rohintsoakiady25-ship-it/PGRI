import { useMemo, useState } from 'react';
import ListePage from '@/components/liste/ListePage';
import Badge, { type TonBadge } from '@/components/common/Badge';
import Modale from '@/components/common/Modale';
import { useAuth } from '@/auth/AuthContext';
import { peutGererReferentiels } from '@/auth/droits';
import { LIBELLE_DISPONIBILITE, LIBELLE_ETAT, vehiculesApi, type Disponibilite, type EtatTechnique, type Vehicule } from '../api';
import { normaliser, useListe } from '../useListe';
import FormulaireVehicule from '../components/FormulaireVehicule';
import ConfirmerSuppression from '../components/ConfirmerSuppression';

const TON_ETAT: Record<EtatTechnique, TonBadge> = { BON: 'succes', A_SURVEILLER: 'attention', EN_REPARATION: 'danger' };
const TON_DISPO: Record<Disponibilite, TonBadge> = { DISPONIBLE: 'succes', INDISPONIBLE: 'attention', HORS_SERVICE: 'neutre' };
const nombre = (n: number) => n.toLocaleString('fr-FR');

/** Liste des voitures (entité Vehicule, Figure 3). */
export default function ListeVehiculesPage() {
  const { utilisateur } = useAuth();
  const gestion = peutGererReferentiels(utilisateur);
  const { elements, chargement, erreur, recharger } = useListe(vehiculesApi.lister);
  const [recherche, setRecherche] = useState('');
  const [etat, setEtat] = useState('');
  const [dispo, setDispo] = useState('');
  const [edition, setEdition] = useState<Vehicule | 'nouveau' | null>(null);
  const [aSupprimer, setASupprimer] = useState<Vehicule | null>(null);

  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return elements.filter(
      (v) =>
        (!q || normaliser(`${v.immatriculation} ${v.marqueModele}`).includes(q)) &&
        (!etat || v.etatTechnique === etat) &&
        (!dispo || v.disponibilite === dispo),
    );
  }, [elements, recherche, etat, dispo]);

  const colonnes = [
    { label: 'Immatriculation' },
    { label: 'Marque et modèle' },
    { label: 'Places', numerique: true },
    { label: 'Kilométrage', numerique: true },
    { label: 'État technique' },
    { label: 'Disponibilité' },
    ...(gestion ? [{ label: 'Actions', sr: true }] : []),
  ];

  return (
    <>
      <ListePage
        titre="Liste des voitures"
        intro="Véhicules de MNP disponibles pour les déplacements de service. Le responsable logistique les affecte aux missions validées."
        placeholderRecherche="Rechercher par immatriculation ou modèle"
        recherche={recherche}
        onRecherche={setRecherche}
        filtres={[
          { id: 'etat', label: 'État technique', valeur: etat, onChange: setEtat,
            options: (Object.keys(LIBELLE_ETAT) as EtatTechnique[]).map((k) => ({ valeur: k, libelle: LIBELLE_ETAT[k] })) },
          { id: 'dispo', label: 'Disponibilité', valeur: dispo, onChange: setDispo,
            options: (Object.keys(LIBELLE_DISPONIBILITE) as Disponibilite[]).map((k) => ({ valeur: k, libelle: LIBELLE_DISPONIBILITE[k] })) },
        ]}
        colonnes={colonnes}
        lignes={visibles.map((v) => ({
          cle: v.id,
          attenuee: !v.actif,
          cellules: [
            <strong key="i">{v.immatriculation}</strong>,
            v.marqueModele,
            v.nbPlaces,
            `${nombre(v.kilometrage)} km`,
            <Badge key="e" ton={TON_ETAT[v.etatTechnique]}>{LIBELLE_ETAT[v.etatTechnique]}</Badge>,
            <Badge key="d" ton={TON_DISPO[v.disponibilite]}>{LIBELLE_DISPONIBILITE[v.disponibilite]}</Badge>,
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
