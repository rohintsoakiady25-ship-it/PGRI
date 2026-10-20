interface Barre {
  libelle: string;
  valeur: number;
  /** Texte de la valeur au bout de la barre (ex. « 3 missions »). */
  texte: string;
  /** Détail au survol (ex. « 12 h sur la route »). */
  detail?: string;
}

interface Props {
  barres: Barre[];
  /** Couleur de la série (celle du module, pour garder la même identité que le graphique des demandes). */
  couleur: string;
  vide: string;
}

/** Barres horizontales d'une seule série : longueur = valeur, valeur écrite au bout (pas de légende : le titre la nomme). */
export default function Barres({ barres, couleur, vide }: Props) {
  const max = Math.max(...barres.map((b) => b.valeur), 0);
  if (!barres.length || max === 0) return <p className="tdb-vide">{vide}</p>;
  return (
    <ul className="barres">
      {barres.map((b) => (
        <li key={b.libelle} className="barres__ligne" title={b.detail ? `${b.libelle} : ${b.texte} · ${b.detail}` : `${b.libelle} : ${b.texte}`}>
          <span className="barres__libelle">{b.libelle}</span>
          <span className="barres__piste">
            {b.valeur > 0 && <span className="barres__barre" style={{ width: `${(b.valeur / max) * 100}%`, background: couleur }} />}
            <span className="barres__valeur">{b.texte}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
