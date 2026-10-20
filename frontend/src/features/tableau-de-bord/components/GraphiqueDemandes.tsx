import { useEffect, useRef, useState } from 'react';
import { moisCourt, libelleMois, type TableauDeBord } from '../api';

type Ligne = TableauDeBord['demandesParMois'][number];

/** Les trois modules, chacun avec sa couleur catégorielle (validée clair et sombre). */
const SERIES = [
  { cle: 'deplacements', libelle: 'Déplacements', couleur: 'var(--serie-deplacements)' },
  { cle: 'salles', libelle: 'Salles de réunion', couleur: 'var(--serie-salles)' },
  { cle: 'fournitures', libelle: 'Fournitures', couleur: 'var(--serie-fournitures)' },
] as const;

type Serie = (typeof SERIES)[number];

const H = 190;
const MARGE = { haut: 18, bas: 26, gauche: 28, droite: 6 };
const LARGEUR_BARRE = 20;

/** Graduation « propre » au-dessus du maximum (1, 2, 5 × 10ⁿ). */
function echelle(max: number) {
  if (max <= 4) return { haut: 4, pas: 1 };
  const brut = max / 4;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 5, 10].map((k) => k * p).find((k) => k >= brut)!;
  return { haut: pas * Math.ceil(max / pas), pas };
}

/** Colonnes d'un seul module sur les six derniers mois. Survol : valeur du mois. */
function Colonnes({ donnees, serie }: { donnees: Ligne[]; serie: Serie }) {
  const [survol, setSurvol] = useState<number | null>(null);
  // Dessiné à la largeur réelle de son bloc : le texte garde sa taille (pas de mise à l'échelle)
  const zoneRef = useRef<HTMLDivElement>(null);
  const [L, setL] = useState(300);
  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setL(Math.max(200, Math.round(e.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const valeurs = donnees.map((d) => d[serie.cle]);
  const total = valeurs.reduce((a, b) => a + b, 0);
  const { haut, pas } = echelle(Math.max(...valeurs, 0));
  const zone = { l: L - MARGE.gauche - MARGE.droite, h: H - MARGE.haut - MARGE.bas };
  const y = (v: number) => MARGE.haut + zone.h - (v / haut) * zone.h;
  const bande = zone.l / donnees.length;
  const graduations = Array.from({ length: haut / pas + 1 }, (_, i) => i * pas);

  return (
    <figure className="mini-graphique">
      <figcaption className="mini-graphique__titre">
        <span className="legende__pastille" style={{ background: serie.couleur }} aria-hidden="true" />
        {serie.libelle}
        <span className="mini-graphique__total">{total} demande{total > 1 ? 's' : ''} en 6 mois</span>
      </figcaption>
      <div className="graphique__zone" ref={zoneRef}>
        <svg viewBox={`0 0 ${L} ${H}`} width={L} height={H} role="img" className="graphique__svg"
          aria-label={`${serie.libelle} : demandes soumises par mois`} onMouseLeave={() => setSurvol(null)}>
          {graduations.map((g) => (
            <g key={g}>
              <line x1={MARGE.gauche} x2={L - MARGE.droite} y1={y(g)} y2={y(g)} className="graphique__grille" />
              <text x={MARGE.gauche - 6} y={y(g)} className="graphique__axe" textAnchor="end" dominantBaseline="middle">{g}</text>
            </g>
          ))}
          {donnees.map((d, i) => {
            const v = valeurs[i];
            const x = MARGE.gauche + bande * i + (bande - LARGEUR_BARRE) / 2;
            const sommet = y(v);
            const h = y(0) - sommet;
            const r = Math.min(4, h);
            return (
              <g key={d.mois} onMouseEnter={() => setSurvol(i)} onFocus={() => setSurvol(i)} onBlur={() => setSurvol(null)} tabIndex={0}
                aria-label={`${libelleMois(d.mois)} : ${v} demande${v > 1 ? 's' : ''}`}>
                {/* zone de survol plus large que la colonne */}
                <rect x={MARGE.gauche + bande * i} y={MARGE.haut} width={bande} height={zone.h} className="graphique__cible" />
                {v > 0 && (
                  // Bout de colonne arrondi (4px), base carrée
                  <path fill={serie.couleur}
                    d={`M${x},${y(0)} V${sommet + r} Q${x},${sommet} ${x + r},${sommet} H${x + LARGEUR_BARRE - r} Q${x + LARGEUR_BARRE},${sommet} ${x + LARGEUR_BARRE},${sommet + r} V${y(0)} Z`} />
                )}
                {v > 0 && (
                  <text x={x + LARGEUR_BARRE / 2} y={sommet - 6} className="graphique__valeur" textAnchor="middle">{v}</text>
                )}
                <text x={x + LARGEUR_BARRE / 2} y={H - 8} className="graphique__axe" textAnchor="middle">{moisCourt(d.mois)}</text>
              </g>
            );
          })}
        </svg>
        {survol !== null && (
          <div className="infobulle" style={{ left: `${((MARGE.gauche + bande * survol + bande / 2) / L) * 100}%` }} role="status">
            <strong>{libelleMois(donnees[survol].mois)}</strong>
            <span className="infobulle__ligne">
              <span className="legende__pastille" style={{ background: serie.couleur }} aria-hidden="true" />
              {serie.libelle}
              <span className="infobulle__valeur">{valeurs[survol]}</span>
            </span>
          </div>
        )}
      </div>
    </figure>
  );
}

/**
 * Demandes soumises par mois : un graphique par module (déplacements, salles, fournitures),
 * chacun avec sa propre échelle. La vue tableau reprend les trois modules.
 */
export default function GraphiqueDemandes({ donnees }: { donnees: Ligne[] }) {
  const [tableau, setTableau] = useState(false);

  return (
    <div className="graphique">
      <div className="graphique__barre">
        <button type="button" className="graphique__bascule" onClick={() => setTableau((t) => !t)} aria-pressed={tableau}>
          {tableau ? 'Voir les graphiques' : 'Voir en tableau'}
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
            </tr>
          </thead>
          <tbody>
            {donnees.map((d) => (
              <tr key={d.mois}>
                <td>{libelleMois(d.mois)}</td>
                {SERIES.map((s) => (
                  <td key={s.cle} className="tdb-table__num">{d[s.cle]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mini-graphiques">
          {SERIES.map((s) => (
            <Colonnes key={s.cle} donnees={donnees} serie={s} />
          ))}
        </div>
      )}
    </div>
  );
}
