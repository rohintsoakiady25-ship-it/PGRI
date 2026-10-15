import { useMemo, useState } from 'react';
import ListePage from '@/components/liste/ListePage';
import Badge from '@/components/common/Badge';
import Modale from '@/components/common/Modale';
import ConfirmerSuppression from '@/components/common/ConfirmerSuppression';
import { normaliser, useListe } from '@/hooks/useListe';
import { sallesApi, type Salle } from '../api';
import FormulaireSalle from '../components/FormulaireSalle';

/** Liste des salles de réunion (entité Salle, Figure 3) : logistique et administrateur. */
export default function ListeSallesPage() {
  const { elements, chargement, erreur, recharger } = useListe(sallesApi.lister);
  const [recherche, setRecherche] = useState('');
  const [edition, setEdition] = useState<Salle | 'nouvelle' | null>(null);
  const [aSupprimer, setASupprimer] = useState<Salle | null>(null);

  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return elements.filter((s) => !q || normaliser(`${s.nom} ${s.equipements.join(' ')} ${s.localisation ?? ''}`).includes(q));
  }, [elements, recherche]);

  return (
    <>
      <ListePage
        titre="Liste des salles"
        placeholderRecherche="Rechercher par nom, équipement ou localisation"
        recherche={recherche}
        onRecherche={setRecherche}
        colonnes={[
          { label: 'Nom' }, { label: 'Capacité', numerique: true }, { label: 'Équipements' }, { label: 'Localisation' },
          { label: 'Statut' }, { label: 'Actions', sr: true },
        ]}
        lignes={visibles.map((s) => ({
          cle: s.id,
          attenuee: !s.actif,
          cellules: [
            <strong key="n">{s.nom}</strong>,
            `${s.capacite} places`,
            s.equipements.length ? s.equipements.join(', ') : '—',
            s.localisation ?? '—',
            <Badge key="b" ton={s.actif ? 'succes' : 'neutre'}>{s.actif ? 'En service' : 'Hors service'}</Badge>,
            <span key="a" className="liste__actions-ligne">
              <button type="button" className="btn btn--petit" onClick={() => setEdition(s)} aria-label={`Modifier la salle ${s.nom}`}>
                Modifier
              </button>
              <button type="button" className="btn btn--petit btn--petit-danger" onClick={() => setASupprimer(s)}
                aria-label={`Supprimer la salle ${s.nom}`}>
                Supprimer
              </button>
            </span>,
          ],
        }))}
        chargement={chargement}
        erreur={erreur}
        total={elements.length}
        messageVide="Aucune salle enregistrée. Ajoutez la Salle 1 et la Salle 2 avec le bouton « Ajouter une salle »."
        action={
          <button type="button" className="btn btn--primary" onClick={() => setEdition('nouvelle')}>
            + Ajouter une salle
          </button>
        }
      />
      <Modale
        ouverte={edition !== null}
        titre={edition === 'nouvelle' ? 'Ajouter une salle' : `Modifier ${edition ? edition.nom : ''}`}
        onFermer={() => setEdition(null)}
      >
        <FormulaireSalle
          salle={edition === 'nouvelle' ? null : edition}
          onAnnuler={() => setEdition(null)}
          onEnregistre={() => {
            setEdition(null);
            recharger();
          }}
        />
      </Modale>
      <Modale ouverte={aSupprimer !== null} titre="Supprimer la salle ?" onFermer={() => setASupprimer(null)}>
        {aSupprimer && (
          <ConfirmerSuppression
            nom={aSupprimer.nom}
            supprimer={() => sallesApi.supprimer(aSupprimer.id)}
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
