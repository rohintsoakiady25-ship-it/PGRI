import { useCallback, useMemo, useState } from 'react';
import ListePage from '@/components/liste/ListePage';
import Modale from '@/components/common/Modale';
import { useAuth } from '@/auth/AuthContext';
import { peutGererReferentiels } from '@/auth/droits';
import CelluleDisponibilite from '../components/CelluleDisponibilite';
import FicheMissions from '../components/FicheMissions';
import { chauffeursApi, LIBELLE_DISPONIBILITE, type Chauffeur, type Disponibilite } from '../api';
import { normaliser, useListe } from '@/hooks/useListe';
import FormulaireChauffeur from '../components/FormulaireChauffeur';
import ConfirmerSuppression from '@/components/common/ConfirmerSuppression';


/** Liste des chauffeurs (entité Chauffeur, Figure 3). */
export default function ListeChauffeursPage() {
  const { utilisateur } = useAuth();
  const gestion = peutGererReferentiels(utilisateur);
  const { elements, chargement, erreur, recharger } = useListe(chauffeursApi.lister);
  const [recherche, setRecherche] = useState('');
  const [dispo, setDispo] = useState('');
  const [edition, setEdition] = useState<Chauffeur | 'nouveau' | null>(null);
  const [aSupprimer, setASupprimer] = useState<Chauffeur | null>(null);
  const [fiche, setFiche] = useState<Chauffeur | null>(null);
  const chargerMissions = useCallback(() => chauffeursApi.missions(fiche!.id), [fiche]);

  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return elements.filter(
      (c) =>
        (!q || normaliser(`${c.nomComplet} ${c.matricule} ${c.telephone ?? ''} ${c.numeroPermis ?? ''}`).includes(q)) &&
        (!dispo || c.disponibilite === dispo),
    );
  }, [elements, recherche, dispo]);

  const colonnes = [
    { label: 'Nom' },
    { label: 'Matricule' },
    { label: 'Téléphone' },
    { label: 'N° de permis' },
    { label: 'Disponibilité' },
    ...(gestion ? [{ label: 'Actions', sr: true }] : []),
  ];

  return (
    <>
      <ListePage
        titre="Liste des chauffeurs"
        placeholderRecherche="Rechercher par nom, matricule ou téléphone"
        recherche={recherche}
        onRecherche={setRecherche}
        filtres={[
          { id: 'dispo', label: 'Disponibilité', valeur: dispo, onChange: setDispo,
            options: (['DISPONIBLE', 'EN_MISSION', 'HORS_SERVICE'] as Disponibilite[]).map((k) => ({ valeur: k, libelle: LIBELLE_DISPONIBILITE[k] })) },
        ]}
        colonnes={colonnes}
        lignes={visibles.map((c) => ({
          cle: c.id,
          attenuee: !c.actif,
          onOuvrir: () => setFiche(c),
          libelleOuvrir: `Voir les missions de ${c.nomComplet}`,
          cellules: [
            <strong key="n">{c.nomComplet}</strong>,
            c.matricule,
            c.telephone ? <a key="t" href={`tel:${c.telephone.replace(/\s/g, '')}`}>{c.telephone}</a> : '—',
            c.numeroPermis ?? '—',
            <CelluleDisponibilite key="d" disponibilite={c.disponibilite} mission={c.mission} prochaineMission={c.prochaineMission} />,
            ...(gestion
              ? [
                  <span key="a" className="liste__actions-ligne">
                    <button type="button" className="btn btn--petit" onClick={() => setEdition(c)}
                      aria-label={`Modifier le chauffeur ${c.nomComplet}`}>
                      Modifier
                    </button>
                    <button type="button" className="btn btn--petit btn--petit-danger" onClick={() => setASupprimer(c)}
                      aria-label={`Supprimer le chauffeur ${c.nomComplet}`}>
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
        messageVide={gestion ? 'Aucun chauffeur enregistré. Ajoutez-en un avec le bouton « Ajouter un chauffeur ».' : 'Aucun chauffeur enregistré pour le moment.'}
        action={
          gestion && (
            <button type="button" className="btn btn--primary" onClick={() => setEdition('nouveau')}>
              + Ajouter un chauffeur
            </button>
          )
        }
      />
      <Modale
        ouverte={edition !== null}
        titre={edition === 'nouveau' ? 'Ajouter un chauffeur' : `Modifier ${edition ? edition.nomComplet : ''}`}
        onFermer={() => setEdition(null)}
      >
        <FormulaireChauffeur
          chauffeur={edition === 'nouveau' ? null : edition}
          onAnnuler={() => setEdition(null)}
          onEnregistre={() => {
            setEdition(null);
            recharger();
          }}
        />
      </Modale>
      <Modale ouverte={fiche !== null} titre={fiche ? `${fiche.nomComplet} · matricule ${fiche.matricule}` : ''} onFermer={() => setFiche(null)} large>
        {fiche && <FicheMissions cible="chauffeur" charger={chargerMissions} />}
      </Modale>
      <Modale ouverte={aSupprimer !== null} titre="Supprimer le chauffeur ?" onFermer={() => setASupprimer(null)}>
        {aSupprimer && (
          <ConfirmerSuppression
            nom={aSupprimer.nomComplet}
            supprimer={() => chauffeursApi.supprimer(aSupprimer.id)}
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
