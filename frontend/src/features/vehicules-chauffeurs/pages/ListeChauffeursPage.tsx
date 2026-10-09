import { useMemo, useState } from 'react';
import ListePage from '@/components/liste/ListePage';
import Badge, { type TonBadge } from '@/components/common/Badge';
import Modale from '@/components/common/Modale';
import { useAuth } from '@/auth/AuthContext';
import { peutGererReferentiels } from '@/auth/droits';
import { chauffeursApi, LIBELLE_DISPONIBILITE, type Chauffeur, type Disponibilite } from '../api';
import { normaliser, useListe } from '../useListe';
import FormulaireChauffeur from '../components/FormulaireChauffeur';
import ConfirmerSuppression from '../components/ConfirmerSuppression';

const TON_DISPO: Record<Disponibilite, TonBadge> = { DISPONIBLE: 'succes', INDISPONIBLE: 'attention', HORS_SERVICE: 'neutre' };

/** Liste des chauffeurs (entité Chauffeur, Figure 3). */
export default function ListeChauffeursPage() {
  const { utilisateur } = useAuth();
  const gestion = peutGererReferentiels(utilisateur);
  const { elements, chargement, erreur, recharger } = useListe(chauffeursApi.lister);
  const [recherche, setRecherche] = useState('');
  const [dispo, setDispo] = useState('');
  const [edition, setEdition] = useState<Chauffeur | 'nouveau' | null>(null);
  const [aSupprimer, setASupprimer] = useState<Chauffeur | null>(null);

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
        intro="Chauffeurs de MNP affectables aux déplacements de service par le responsable logistique."
        placeholderRecherche="Rechercher par nom, matricule ou téléphone"
        recherche={recherche}
        onRecherche={setRecherche}
        filtres={[
          { id: 'dispo', label: 'Disponibilité', valeur: dispo, onChange: setDispo,
            options: (['DISPONIBLE', 'HORS_SERVICE'] as Disponibilite[]).map((k) => ({ valeur: k, libelle: LIBELLE_DISPONIBILITE[k] })) },
        ]}
        colonnes={colonnes}
        lignes={visibles.map((c) => ({
          cle: c.id,
          attenuee: !c.actif,
          cellules: [
            <strong key="n">{c.nomComplet}</strong>,
            c.matricule,
            c.telephone ? <a key="t" href={`tel:${c.telephone.replace(/\s/g, '')}`}>{c.telephone}</a> : '—',
            c.numeroPermis ?? '—',
            <Badge key="d" ton={TON_DISPO[c.disponibilite]}>{LIBELLE_DISPONIBILITE[c.disponibilite]}</Badge>,
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
