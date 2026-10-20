import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { messageErreur } from '@/api/client';
import logoMnp from '@/assets/logo-mnp.png';
import { demandesFournitureApi, quantiteAvecUnite, type BonDeSortie } from '../api';
import './BonDeSortiePage.css';

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * Bon de sortie numérique d'une demande de fournitures remise. Page sans menu, prévue pour l'impression :
 * « Imprimer » ouvre la boîte d'impression du navigateur, qui permet aussi d'enregistrer en PDF.
 */
export default function BonDeSortiePage() {
  const { id = '' } = useParams();
  const [bon, setBon] = useState<BonDeSortie | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    demandesFournitureApi.bonDeSortie(id).then(setBon).catch((e) => setErreur(messageErreur(e, 'Le bon de sortie n’a pas pu être chargé.')));
  }, [id]);

  useEffect(() => {
    if (bon) document.title = `Bon de sortie ${bon.numero}`;
  }, [bon]);

  if (!bon) return <p className="bon__message">{erreur ?? 'Chargement…'}</p>;
  const { demande } = bon;

  return (
    <div className="bon">
      <div className="bon__outils">
        <Link to="/mes-demandes" className="btn btn--secondary">
          ← Retour
        </Link>
        <button type="button" className="btn btn--primary" onClick={() => window.print()}>
          Imprimer / PDF
        </button>
      </div>

      <article className="bon__page">
        <header className="bon__entete">
          <img src={logoMnp} alt="Madagascar National Parks" className="bon__logo" />
          <div>
            <h1 className="bon__titre">Bon de sortie</h1>
            <p className="bon__numero">N° {bon.numero}</p>
          </div>
        </header>

        <dl className="bon__infos">
          <div>
            <dt>Date de sortie</dt>
            <dd>
              {date(bon.dateEmission)} à {heure(bon.dateEmission)}
            </dd>
          </div>
          <div>
            <dt>Demande</dt>
            <dd>
              {demande.reference}
              {demande.soumisLe && ` du ${date(demande.soumisLe)}`}
            </dd>
          </div>
          <div>
            <dt>Bénéficiaire</dt>
            <dd>{demande.demandeur.nomComplet}</dd>
          </div>
          <div>
            <dt>Direction / service</dt>
            <dd>{[demande.demandeur.direction, demande.demandeur.service].filter(Boolean).join(' · ') || '—'}</dd>
          </div>
        </dl>

        <table className="bon__table">
          <thead>
            <tr>
              <th scope="col">Référence</th>
              <th scope="col">Désignation</th>
              <th scope="col" className="bon__num">Demandé</th>
              <th scope="col" className="bon__num">Remis</th>
              <th scope="col">Observations</th>
            </tr>
          </thead>
          <tbody>
            {bon.lignes.map((l) => (
              <tr key={l.reference}>
                <td>{l.reference}</td>
                <td>{l.designation}</td>
                <td className="bon__num">{quantiteAvecUnite(l.quantiteDemandee, l.unite)}</td>
                <td className="bon__num">
                  <strong>{quantiteAvecUnite(l.quantiteLivree, l.unite)}</strong>
                </td>
                <td>{l.observations ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {demande.observations && <p className="bon__observations">Observations : {demande.observations}</p>}

        <div className="bon__signatures">
          <div>
            <p>Le magasinier</p>
            <p className="bon__nom">{bon.magasinier}</p>
          </div>
          <div>
            <p>Le bénéficiaire</p>
            <p className="bon__nom">{demande.demandeur.nomComplet}</p>
          </div>
        </div>

        <footer className="bon__pied">Document généré par la plateforme PGRI — DSII, Madagascar National Parks</footer>
      </article>
    </div>
  );
}
