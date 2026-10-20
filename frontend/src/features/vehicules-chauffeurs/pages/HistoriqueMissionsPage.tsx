import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ListePage from '@/components/liste/ListePage';
import Badge from '@/components/common/Badge';
import { normaliser, useListe } from '@/hooks/useListe';
import { periode } from '@/features/deplacements/api';
import { dateHeure } from '@/features/salles/api';
import { chauffeursApi, LIBELLE_STATUT_MISSION, TON_STATUT_MISSION, vehiculesApi, type MissionFiche } from '../api';

interface Props {
  cible: 'vehicule' | 'chauffeur';
}

/** Historique complet des déplacements d'un véhicule ou d'un chauffeur (missions terminées ou annulées). */
export default function HistoriqueMissionsPage({ cible }: Props) {
  const { id = '' } = useParams();
  const [titre, setTitre] = useState('');
  const charger = useCallback(async (): Promise<MissionFiche[]> => {
    if (cible === 'vehicule') {
      const h = await vehiculesApi.historique(id);
      setTitre([h.vehicule.immatriculation, h.vehicule.marqueModele].filter(Boolean).join(' · '));
      return h.missions;
    }
    const h = await chauffeursApi.historique(id);
    setTitre(`${h.chauffeur.nomComplet} · matricule ${h.chauffeur.matricule}`);
    return h.missions;
  }, [cible, id]);
  const { elements, chargement, erreur } = useListe(charger);
  const [recherche, setRecherche] = useState('');
  const [annee, setAnnee] = useState('');
  const [incidents, setIncidents] = useState('');

  const annees = useMemo(() => [...new Set(elements.map((m) => m.debut.slice(0, 4)))].sort().reverse(), [elements]);
  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return elements.filter(
      (m) =>
        (!q ||
          normaliser(
            `${m.chauffeur.nomComplet} ${m.vehicule.immatriculation} ${m.incidents ?? ''} ${m.demandes
              .map((d) => `${d.reference} ${d.demandeur} ${d.lieuDepart} ${d.destination} ${d.motif}`)
              .join(' ')}`,
          ).includes(q)) &&
        (!annee || m.debut.startsWith(annee)) &&
        (!incidents || (incidents === 'oui') === Boolean(m.incidents)),
    );
  }, [elements, recherche, annee, incidents]);

  const retour = cible === 'vehicule' ? '/deplacements/vehicules' : '/deplacements/chauffeurs';
  return (
    <ListePage
      titre={titre ? `Historique · ${titre}` : 'Historique des déplacements'}
      placeholderRecherche="Rechercher par référence, demandeur, lieu, motif ou incident"
      recherche={recherche}
      onRecherche={setRecherche}
      filtres={[
        { id: 'annee', label: 'Année', valeur: annee, onChange: setAnnee, options: annees.map((a) => ({ valeur: a, libelle: a })) },
        { id: 'incidents', label: 'Incidents', valeur: incidents, onChange: setIncidents,
          options: [{ valeur: 'oui', libelle: 'Avec incident' }, { valeur: 'non', libelle: 'Sans incident' }] },
      ]}
      colonnes={[
        { label: 'Dates prévues' }, { label: cible === 'vehicule' ? 'Chauffeur' : 'Véhicule' }, { label: 'Demandes' },
        { label: 'Départ et retour réels' }, { label: 'Incidents' }, { label: 'Statut' },
      ]}
      lignes={visibles.map((m) => ({
        cle: m.id,
        attenuee: m.statut === 'ANNULEE',
        cellules: [
          periode(m.debut, m.fin),
          cible === 'vehicule' ? m.chauffeur.nomComplet : m.vehicule.immatriculation,
          <span key="d" className="liste__empile">
            {m.demandes.map((d) => (
              <span key={d.id}>
                <strong>{d.reference}</strong> {d.lieuDepart} → {d.destination}
                <span className="liste__discret"> · {d.demandeur}</span>
              </span>
            ))}
          </span>,
          <span key="r" className="liste__empile">
            {m.heureDepartReelle ? dateHeure(m.heureDepartReelle) : '—'}
            {m.heureRetourReelle && <span className="liste__discret">retour {dateHeure(m.heureRetourReelle)}</span>}
          </span>,
          m.incidents ?? '—',
          <Badge key="s" ton={TON_STATUT_MISSION[m.statut]}>{LIBELLE_STATUT_MISSION[m.statut]}</Badge>,
        ],
      }))}
      chargement={chargement}
      erreur={erreur}
      total={elements.length}
      messageVide="Aucun déplacement effectué pour l’instant."
      action={
        <Link to={retour} className="btn btn--secondary">
          ← {cible === 'vehicule' ? 'Liste des voitures' : 'Liste des chauffeurs'}
        </Link>
      }
    />
  );
}
