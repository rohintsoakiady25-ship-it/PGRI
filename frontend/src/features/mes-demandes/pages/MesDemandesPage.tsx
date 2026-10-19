import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ListePage from '@/components/liste/ListePage';
import Badge, { type TonBadge } from '@/components/common/Badge';
import Modale from '@/components/common/Modale';
import { normaliser, useListe } from '@/hooks/useListe';
import { creneau, demandesSalleApi, LIBELLE_STATUT, TON_STATUT } from '@/features/salles/api';
import DetailDemandeSalle from '@/features/salles/components/DetailDemandeSalle';
import {
  demandesDeplacementApi, LIBELLE_STATUT_DEPLACEMENT, LIBELLE_TYPE, periode, TON_STATUT_DEPLACEMENT,
} from '@/features/deplacements/api';
import DetailDemandeDeplacement from '@/features/deplacements/components/DetailDemandeDeplacement';

type Module = 'SALLE' | 'DEPLACEMENT';

/** Une ligne de la liste, quel que soit le type de demande. */
interface Ligne {
  id: string;
  module: Module;
  reference: string;
  demande: ReactNode;
  quand: string;
  objet: string;
  /** Pour la recherche et le tri. */
  texte: string;
  date: string;
  statut: string;
  ton: TonBadge;
  terminee: boolean;
  nbCommentaires: number;
}

const LIBELLE_MODULE: Record<Module, string> = { SALLE: 'Salle de réunion', DEPLACEMENT: 'Déplacement' };
const TERMINES = ['ANNULEE', 'LIBEREE', 'TERMINEE', 'REFUSEE'];

/** Mes demandes, tous modules confondus : réservations de salle et demandes de déplacement. */
export default function MesDemandesPage() {
  const message = (useLocation().state as { message?: string } | null)?.message;

  const charger = useCallback(async (): Promise<Ligne[]> => {
    const [salles, deplacements] = await Promise.all([demandesSalleApi.mes(), demandesDeplacementApi.mes()]);
    return [
      ...salles.map((d) => ({
        id: d.id,
        module: 'SALLE' as const,
        reference: d.reference,
        demande: d.salle.nom,
        quand: creneau(d.creneauDebut, d.creneauFin),
        objet: d.objet,
        texte: `${d.reference} ${d.objet} ${d.salle.nom}`,
        date: d.creneauDebut,
        statut: LIBELLE_STATUT[d.statut],
        ton: TON_STATUT[d.statut],
        terminee: TERMINES.includes(d.statut),
        nbCommentaires: d.nbCommentaires,
      })),
      ...deplacements.map((d) => ({
        id: d.id,
        module: 'DEPLACEMENT' as const,
        reference: d.reference,
        demande: (
          <span>
            {d.lieuDepart} → {d.destination}
            <span className="liste__discret"> · {LIBELLE_TYPE[d.typeDeplacement]}</span>
          </span>
        ),
        quand: periode(d.dateHeureDepart, d.dateHeureRetourPrevue),
        objet: d.motif,
        texte: `${d.reference} ${d.motif} ${d.lieuDepart} ${d.destination}`,
        date: d.dateHeureDepart,
        statut: LIBELLE_STATUT_DEPLACEMENT[d.statut],
        ton: TON_STATUT_DEPLACEMENT[d.statut],
        terminee: TERMINES.includes(d.statut),
        nbCommentaires: 0,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, []);

  const { elements, chargement, erreur, recharger } = useListe(charger);
  const [recherche, setRecherche] = useState('');
  const [module, setModule] = useState('');
  const [statut, setStatut] = useState('');
  const [ouverte, setOuverte] = useState<Ligne | null>(null);

  const statuts = useMemo(() => [...new Set(elements.map((l) => l.statut))].sort((a, b) => a.localeCompare(b, 'fr')), [elements]);
  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return elements.filter(
      (l) => (!q || normaliser(l.texte).includes(q)) && (!module || l.module === module) && (!statut || l.statut === statut),
    );
  }, [elements, recherche, module, statut]);

  return (
    <>
      <ListePage
        titre="Mes demandes"
        bandeau={message}
        placeholderRecherche="Rechercher par référence, objet, lieu ou salle"
        recherche={recherche}
        onRecherche={setRecherche}
        filtres={[
          { id: 'module', label: 'Type', valeur: module, onChange: setModule,
            options: (Object.keys(LIBELLE_MODULE) as Module[]).map((k) => ({ valeur: k, libelle: LIBELLE_MODULE[k] })) },
          { id: 'statut', label: 'Statut', valeur: statut, onChange: setStatut, options: statuts.map((s) => ({ valeur: s, libelle: s })) },
        ]}
        colonnes={[
          { label: 'Référence' }, { label: 'Demande' }, { label: 'Date' }, { label: 'Objet / motif' }, { label: 'Statut' },
          { label: 'Actions', sr: true },
        ]}
        lignes={visibles.map((l) => ({
          cle: l.id,
          attenuee: l.terminee,
          cellules: [
            <span key="r" className="liste__empile">
              <strong>{l.reference}</strong>
              <span className="liste__discret">{LIBELLE_MODULE[l.module]}</span>
            </span>,
            l.demande,
            l.quand,
            l.objet,
            <Badge key="s" ton={l.ton}>{l.statut}</Badge>,
            <span key="a" className="liste__actions-ligne">
              {l.nbCommentaires > 0 && (
                <span className="liste__discret">
                  {l.nbCommentaires} commentaire{l.nbCommentaires > 1 ? 's' : ''}
                </span>
              )}
              <button type="button" className="btn btn--petit" onClick={() => setOuverte(l)} aria-label={`Voir la demande ${l.reference}`}>
                Voir
              </button>
            </span>,
          ],
        }))}
        chargement={chargement}
        erreur={erreur}
        total={elements.length}
        messageVide="Vous n’avez encore fait aucune demande."
        action={
          <span className="liste__actions-ligne">
            <Link to="/demandes/deplacement" className="btn btn--secondary">
              + Déplacement
            </Link>
            <Link to="/demandes/salle" className="btn btn--primary">
              + Réserver une salle
            </Link>
          </span>
        }
      />
      <Modale
        ouverte={ouverte !== null}
        titre={ouverte?.module === 'DEPLACEMENT' ? 'Demande de déplacement' : 'Réservation de salle'}
        onFermer={() => setOuverte(null)}
        large
      >
        {ouverte?.module === 'SALLE' && <DetailDemandeSalle id={ouverte.id} onModifiee={recharger} />}
        {ouverte?.module === 'DEPLACEMENT' && <DetailDemandeDeplacement id={ouverte.id} onModifiee={recharger} />}
      </Modale>
    </>
  );
}
