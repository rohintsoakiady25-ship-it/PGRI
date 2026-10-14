import { useEffect, useMemo, useState } from 'react';
import ListePage from '@/components/liste/ListePage';
import Badge from '@/components/common/Badge';
import Modale from '@/components/common/Modale';
import ConfirmerSuppression from '@/components/common/ConfirmerSuppression';
import { normaliser, useListe } from '@/hooks/useListe';
import { equipementsApi, sallesApi, type Equipement, type Salle } from '../api';
import FormulaireEquipement from '../components/FormulaireEquipement';

/** Matériel des salles de réunion (écran, vidéoprojecteur, tableau blanc…) : logistique et administrateur. */
export default function EquipementsPage() {
  const { elements, chargement, erreur, recharger } = useListe(equipementsApi.lister);
  const [salles, setSalles] = useState<Salle[]>([]);
  const [recherche, setRecherche] = useState('');
  const [salleFiltre, setSalleFiltre] = useState('');
  const [rattachement, setRattachement] = useState('');
  const [edition, setEdition] = useState<Equipement | 'nouveau' | null>(null);
  const [aSupprimer, setASupprimer] = useState<Equipement | null>(null);

  useEffect(() => {
    sallesApi.lister().then(setSalles).catch(() => setSalles([]));
  }, []);

  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return elements.filter(
      (e) =>
        (!q || normaliser(`${e.reference} ${e.nom} ${e.description ?? ''}`).includes(q)) &&
        (!salleFiltre || e.salles.some((s) => s.id === salleFiltre)) &&
        (!rattachement || String(e.plusieursSalles) === rattachement),
    );
  }, [elements, recherche, salleFiltre, rattachement]);

  return (
    <>
      <ListePage
        titre="Équipements"
        intro="Matériel des salles de réunion, un appareil par référence (VP-01, VP-02…). Un appareil est installé dans une seule salle ou partagé entre plusieurs ; une fois réservé, il est indisponible sur ce créneau dans toutes les salles."
        placeholderRecherche="Rechercher par référence ou par nom"
        recherche={recherche}
        onRecherche={setRecherche}
        filtres={[
          { id: 'salle', label: 'Salle', valeur: salleFiltre, onChange: setSalleFiltre,
            options: salles.map((s) => ({ valeur: s.id, libelle: s.nom })) },
          { id: 'rattachement', label: 'Rattachement', valeur: rattachement, onChange: setRattachement,
            options: [{ valeur: 'false', libelle: 'Une seule salle' }, { valeur: 'true', libelle: 'Plusieurs salles' }] },
        ]}
        colonnes={[{ label: 'Référence' }, { label: 'Équipement' }, { label: 'Rattachement' }, { label: 'Salles' }, { label: 'Statut' }, { label: 'Actions', sr: true }]}
        lignes={visibles.map((e) => ({
          cle: e.id,
          attenuee: !e.actif,
          cellules: [
            <strong key="r">{e.reference}</strong>,
            <span key="n">
              {e.nom}
              {e.description && <span className="liste__discret"> · {e.description}</span>}
            </span>,
            e.plusieursSalles ? 'Plusieurs salles' : 'Une seule salle',
            e.salles.length ? e.salles.map((s) => s.nom).join(', ') : '—',
            <Badge key="b" ton={e.actif ? 'succes' : 'neutre'}>{e.actif ? 'En service' : 'Hors service'}</Badge>,
            <span key="a" className="liste__actions-ligne">
              <button type="button" className="btn btn--petit" onClick={() => setEdition(e)} aria-label={`Modifier l’équipement ${e.reference}`}>
                Modifier
              </button>
              <button type="button" className="btn btn--petit btn--petit-danger" onClick={() => setASupprimer(e)}
                aria-label={`Supprimer l’équipement ${e.reference}`}>
                Supprimer
              </button>
            </span>,
          ],
        }))}
        chargement={chargement}
        erreur={erreur}
        total={elements.length}
        messageVide="Aucun équipement enregistré. Ajoutez le matériel des salles avec le bouton « Ajouter un équipement »."
        action={
          <button type="button" className="btn btn--primary" onClick={() => setEdition('nouveau')}>
            + Ajouter un équipement
          </button>
        }
      />
      <Modale
        ouverte={edition !== null}
        titre={edition === 'nouveau' ? 'Ajouter un équipement' : `Modifier ${edition ? `${edition.nom} (${edition.reference})` : ''}`}
        onFermer={() => setEdition(null)}
      >
        <FormulaireEquipement
          equipement={edition === 'nouveau' ? null : edition}
          salles={salles}
          onAnnuler={() => setEdition(null)}
          onEnregistre={() => {
            setEdition(null);
            recharger();
          }}
        />
      </Modale>
      <Modale ouverte={aSupprimer !== null} titre="Supprimer l’équipement ?" onFermer={() => setASupprimer(null)}>
        {aSupprimer && (
          <ConfirmerSuppression
            nom={`${aSupprimer.nom} (${aSupprimer.reference})`}
            supprimer={() => equipementsApi.supprimer(aSupprimer.id)}
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
