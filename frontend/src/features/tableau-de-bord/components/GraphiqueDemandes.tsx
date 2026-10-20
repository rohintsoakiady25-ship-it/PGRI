import { useEffect, useRef, useState } from 'react';
import { moisCourt, libelleMois, type TableauDeBord } from '../api';

type Ligne = TableauDeBord['demandesParMois'][number];

/** Les trois modules, dans l'ordre des couleurs catégorielles (validées clair et sombre). */
const SERIES = [
  { cle: 'salles', libelle: 'Salles de réunion', couleur: 'var(--serie-salles)' },
  { cle: 'deplacements', libelle: 'Déplacements', couleur: 'var(--serie-deplacements)' },
  { cle: 'fournitures', libelle: 'Fournitures', couleur: 'var(--serie-fournitures)' },
] as const;

const H = 220;
const MARGE = { haut: 18, bas: 26, gauche: 30, droite: 8 };
const LARGEUR_BARRE = 24;
const ECART = 2; // espace de la couleur du fond entre deux segments

/** Graduation « propre » au-dessus du maximum (1, 2, 5 × 10ⁿ). */
function echelle(max: number) {
  if (max <= 4) return { haut: 4, pas: 1 };
  const brut = max / 4;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 5, 10].map((k) => k * p).find((k) => k >= brut)!;
  return { haut: pas * Math.ceil(max / pas), pas };
}

/**
 * Demandes soumises par mois, empilées par module (colonnes). Survol : détail du mois.
 * Une légende nomme les séries ; le total est écrit au-dessus de chaque colonne ; la vue tableau reprend tout.
 */
export default function GraphiqueDemandes({ donnees }: { donnees: Ligne[] }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const [tableau, setTableau] = useState(false);
  // Le graphique est dessiné à la largeur réelle de sa carte : le texte garde sa taille (pas de mise à l'échelle)
  const zoneRef = useRef<HTMLDivElement>(null);
  const [L, setL] = useState(520);
  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setL(Math.max(280, Math.round(e.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, [tableau]);
  const totaux = donnees.map((d) => d.salles + d.deplacements + d.fournitures);
  const { haut, pas } = echelle(Math.max(...totaux, 0));
  const zone = { l: L - MARGE.gauche - MARGE.droite, h: H - MARGE.haut - MARGE.bas };
  const y = (v: number) => MARGE.haut + zone.h - (v / haut) * zone.h;
  const bande = zone.l / donnees.length;
  const graduations = Array.from({ length: haut / pas + 1 }, (_, i) => i * pas);

  return (
    <div className="graphique">
      <div className="graphique__barre">
        <ul className="legende" aria-label="Légende">
          {SERIES.map((s) => (
            <li key={s.cle}>
              <span className="legende__pastille" style={{ background: s.couleur }} aria-hidden="true" />
              {s.libelle}
            </li>
          ))}
        </ul>
        <button type="button" className="graphique__bascule" onClick={() => setTableau((t) => !t)} aria-pressed={tableau}>
          {tableau ? 'Voir le graphique' : 'Voir en tableau'}
        </button>
      </div>

      {tableau ? (
        <table className="tdb-table">
          <thead>
            <tr>
              <th scope="col">Mois</th>
              {SERIES.map((s) => (
                <th key={s.cle} scope="col" className="tdb-table__num">{s.libelle}</th>
              ))}
              <th scope="col" className="tdb-table__num">Total</th>
            </tr>
          </thead>
          <tbody>
            {donnees.map((d, i) => (
              <tr key={d.mois}>
                <td>{libelleMois(d.mois)}</td>
                {SERIES.map((s) => (
                  <td key={s.cle} className="tdb-table__num">{d[s.cle]}</td>
                ))}
                <td className="tdb-table__num"><strong>{totaux[i]}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="graphique__zone" ref={zoneRef}>
          <svg viewBox={`0 0 ${L} ${H}`} width={L} height={H} role="img" aria-label="Demandes soumises par mois et par module" className="graphique__svg"
            onMouseLeave={() => setSurvol(null)}>
            {graduations.map((g) => (
              <g key={g}>
                <line x1={MARGE.gauche} x2={L - MARGE.droite} y1={y(g)} y2={y(g)} className="graphique__grille" />
                <text x={MARGE.gauche - 6} y={y(g)} className="graphique__axe" textAnchor="end" dominantBaseline="middle">{g}</text>
              </g>
            ))}
            {donnees.map((d, i) => {
              const x = MARGE.gauche + bande * i + (bande - LARGEUR_BARRE) / 2;
              let cumul = 0;
              const segments = SERIES.map((s) => ({ ...s, v: d[s.cle] })).filter((s) => s.v > 0);
              return (
                <g key={d.mois} onMouseEnter={() => setSurvol(i)} onFocus={() => setSurvol(i)} onBlur={() => setSurvol(null)} tabIndex={0}
                  aria-label={`${libelleMois(d.mois)} : ${totaux[i]} demande${totaux[i] > 1 ? 's' : ''}`}>
                  {/* zone de survol plus large que la colonne */}
                  <rect x={MARGE.gauche + bande * i} y={MARGE.haut} width={bande} height={zone.h} className="graphique__cible" />
                  {segments.map((s, k) => {
                    const bas = y(cumul);
                    cumul += s.v;
                    const sommet = y(cumul);
                    const dernier = k === segments.length - 1;
                    const h = Math.max(bas - sommet - (k > 0 ? ECART : 0), 1);
                    const yHaut = sommet;
                    return dernier ? (
                      // Bout de colonne arrondi (4px), base carrée
                      <path key={s.cle} fill={s.couleur}
                        d={`M${x},${yHaut + h} V${yHaut + 4} Q${x},${yHaut} ${x + 4},${yHaut} H${x + LARGEUR_BARRE - 4} Q${x + LARGEUR_BARRE},${yHaut} ${x + LARGEUR_BARRE},${yHaut + 4} V${yHaut + h} Z`} />
                    ) : (
                      <rect key={s.cle} x={x} y={yHaut} width={LARGEUR_BARRE} height={h} fill={s.couleur} />
                    );
                  })}
                  {totaux[i] > 0 && (
                    <text x={x + LARGEUR_BARRE / 2} y={y(totaux[i]) - 6} className="graphique__valeur" textAnchor="middle">{totaux[i]}</text>
                  )}
                  <text x={x + LARGEUR_BARRE / 2} y={H - 8} className="graphique__axe" textAnchor="middle">{moisCourt(d.mois)}</text>
                </g>
              );
            })}
          </svg>
          {survol !== null && (
            <div className="infobulle" style={{ left: `${((MARGE.gauche + bande * survol + bande / 2) / L) * 100}%` }} role="status">
              <strong>{libelleMois(donnees[survol].mois)}</strong>
              {SERIES.map((s) => (
                <span key={s.cle} className="infobulle__ligne">
                  <span className="legende__pastille" style={{ background: s.couleur }} aria-hidden="true" />
                  {s.libelle}
                  <span className="infobulle__valeur">{donnees[survol][s.cle]}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
