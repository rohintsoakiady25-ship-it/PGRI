/**
 * Recherche de lieux à Madagascar via Nominatim (géocodeur d'OpenStreetMap).
 * À terme, ces appels passeront par l'API PGRI (GET /cartographie/lieux) pour respecter
 * la politique d'usage de Nominatim et pouvoir changer de fournisseur sans toucher au front.
 */

export interface Lieu {
  nom: string;
  detail: string;
  lon: number;
  lat: number;
}

const NOMINATIM = 'https://nominatim.openstreetmap.org';

interface ResultatNominatim {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
}

function versLieu(r: ResultatNominatim): Lieu {
  const morceaux = r.display_name.split(',').map((s) => s.trim());
  const nom = r.name || morceaux[0];
  const detail = morceaux.filter((m) => m !== nom && m !== 'Madagasikara / Madagascar').slice(0, 3).join(', ');
  return { nom, detail, lon: Number(r.lon), lat: Number(r.lat) };
}

/** Lieux correspondant au texte saisi, limités à Madagascar. */
export async function rechercherLieux(texte: string, signal?: AbortSignal): Promise<Lieu[]> {
  const params = new URLSearchParams({
    q: texte,
    format: 'jsonv2',
    countrycodes: 'mg',
    limit: '6',
    'accept-language': 'fr',
  });
  const reponse = await fetch(`${NOMINATIM}/search?${params}`, { signal });
  if (!reponse.ok) throw new Error(`Recherche de lieu impossible (${reponse.status})`);
  const resultats: ResultatNominatim[] = await reponse.json();
  return resultats.map(versLieu);
}

/** Nom du lieu le plus proche d'un point cliqué sur la carte. */
export async function nommerPoint(lon: number, lat: number, signal?: AbortSignal): Promise<Lieu> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    zoom: '14',
    'accept-language': 'fr',
  });
  const point: Lieu = { nom: `Point ${lat.toFixed(4)}, ${lon.toFixed(4)}`, detail: '', lon, lat };
  try {
    const reponse = await fetch(`${NOMINATIM}/reverse?${params}`, { signal });
    if (!reponse.ok) return point;
    const r: ResultatNominatim & { error?: string } = await reponse.json();
    return r.error ? point : { ...versLieu(r), lon, lat };
  } catch {
    return point;
  }
}
