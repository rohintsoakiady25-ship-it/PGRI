import { useState } from 'react';
import { quantiteAvecUnite, type DemandeFourniture, type LigneRemise } from '../api';

interface Props {
  demande: DemandeFourniture;
  envoi: boolean;
  onPrendreEnCharge: () => void;
  onRemettre: (lignes: LigneRemise[]) => void;
}

/**
 * Travail du magasinier : prise en charge, puis remise avec la quantité réellement livrée par article
 * (pré-remplie avec ce que le stock permet). Une livraison partielle demande un motif.
 */
export default function RemiseFournitures({ demande, envoi, onPrendreEnCharge, onRemettre }: Props) {
  const [quantites, setQuantites] = useState<Record<string, string>>(() =>
    Object.fromEntries(demande.lignes.map((l) => [l.id, String(Math.min(l.quantiteDemandee, Math.max(l.enStock ?? 0, 0)))])),
  );
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);

  function remettre() {
    setErreur(null);
    const lignes: LigneRemise[] = [];
    for (const l of demande.lignes) {
      const q = Number(quantites[l.id]);
      if (!Number.isInteger(q) || q < 0) return setErreur(`« ${l.article.designation} » : quantité remise invalide.`);
      if (q > l.quantiteDemandee) return setErreur(`« ${l.article.designation} » : pas plus que la quantité demandée.`);
      if (l.enStock !== null && q > l.enStock) return setErreur(`« ${l.article.designation} » : il n’en reste que ${l.enStock} en stock.`);
      const motif = (motifs[l.id] ?? '').trim();
      if (q < l.quantiteDemandee && !motif) return setErreur(`« ${l.article.designation} » : indiquez pourquoi la livraison est partielle.`);
      lignes.push({ ligneId: l.id, quantiteLivree: q, observations: motif || null });
    }
    if (lignes.every((l) => l.quantiteLivree === 0)) return setErreur('Aucune quantité remise.');
    onRemettre(lignes);
  }

  return (
    <section className="detail__bloc detail__bloc--decision" aria-labelledby="remise-titre">
      <h3 id="remise-titre" className="detail__titre">Remise des fournitures (magasin)</h3>
      {demande.statut === 'VALIDEE' && (
        <div className="remise__prise">
          <span className="detail__discret">Indiquez que la demande est en cours de préparation (le demandeur le voit dans « Mes demandes ») :</span>
          <button type="button" className="btn btn--secondary" disabled={envoi} onClick={onPrendreEnCharge}>
            Prendre en charge
          </button>
        </div>
      )}
      {erreur && (
        <p className="formulaire__erreur" role="alert">
          {erreur}
        </p>
      )}
      <table className="articles remise__table">
        <thead>
          <tr>
            <th scope="col">Article</th>
            <th scope="col" className="articles__num">Demandé</th>
            <th scope="col" className="articles__num">En stock</th>
            <th scope="col" className="articles__num">Remis</th>
            <th scope="col">Motif si partiel</th>
          </tr>
        </thead>
        <tbody>
          {demande.lignes.map((l) => {
            const partiel = Number(quantites[l.id]) < l.quantiteDemandee;
            return (
              <tr key={l.id}>
                <td>{l.article.designation}</td>
                <td className="articles__num">{quantiteAvecUnite(l.quantiteDemandee, l.article.unite)}</td>
                <td className={`articles__num${(l.enStock ?? 0) < l.quantiteDemandee ? ' articles__manque' : ''}`}>
                  {quantiteAvecUnite(l.enStock ?? 0, l.article.unite)}
                </td>
                <td className="articles__num">
                  <input type="number" className="remise__qte" min={0} max={l.quantiteDemandee} step={1} value={quantites[l.id]}
                    aria-label={`Quantité remise de ${l.article.designation}`}
                    onChange={(e) => setQuantites((x) => ({ ...x, [l.id]: e.target.value }))} />
                </td>
                <td>
                  <input type="text" className="remise__motif" maxLength={255} disabled={!partiel}
                    placeholder={partiel ? 'Ex. rupture de stock' : '—'} value={motifs[l.id] ?? ''}
                    aria-label={`Motif de la livraison partielle de ${l.article.designation}`}
                    onChange={(e) => setMotifs((x) => ({ ...x, [l.id]: e.target.value }))} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="detail__boutons">
        <button type="button" className="btn btn--primary" disabled={envoi} onClick={remettre}>
          Enregistrer la remise
        </button>
      </div>
    </section>
  );
}
