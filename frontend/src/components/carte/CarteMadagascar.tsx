import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Circle, Fill, Stroke, Style, Text } from 'ol/style';
import { fromLonLat, toLonLat, transformExtent } from 'ol/proj';
import { boundingExtent } from 'ol/extent';
import { defaults as defaultControls, ScaleLine } from 'ol/control';
import type { Lieu } from './lieux';
import type { Itineraire } from './itineraire';
import 'ol/ol.css';
import './CarteMadagascar.css';

// Emprise de navigation : assez large pour qu'un cadre plus large que haut affiche toute l'île
const EMPRISE_MADAGASCAR = transformExtent([30.0, -29.0, 64.0, -8.0], 'EPSG:4326', 'EPSG:3857');
const ILE_MADAGASCAR = transformExtent([43.2, -25.6, 50.5, -11.9], 'EPSG:4326', 'EPSG:3857');

const ORANGE = '#a84f06';
const BRUN = '#2b1d12';

const etiquette = (texte: string) =>
  new Text({
    text: texte,
    offsetY: -18,
    font: '600 12px "Source Sans 3 Variable", sans-serif',
    fill: new Fill({ color: BRUN }),
    stroke: new Stroke({ color: '#fff', width: 3 }),
  });

const styleDepart = (nom: string) =>
  new Style({
    image: new Circle({ radius: 7, fill: new Fill({ color: '#fff' }), stroke: new Stroke({ color: ORANGE, width: 3 }) }),
    text: etiquette(nom),
    zIndex: 10,
  });

const styleDestination = (nom: string) =>
  new Style({
    image: new Circle({ radius: 8, fill: new Fill({ color: ORANGE }), stroke: new Stroke({ color: '#fff', width: 2.5 }) }),
    text: etiquette(nom),
    zIndex: 10,
  });

// Itinéraire retenu : trait orange sur liseré blanc ; autres itinéraires : gris
const styleItineraireRetenu = [
  new Style({ stroke: new Stroke({ color: '#fff', width: 8 }), zIndex: 5 }),
  new Style({ stroke: new Stroke({ color: ORANGE, width: 5 }), zIndex: 6 }),
];
const styleItineraireAutre = [
  new Style({ stroke: new Stroke({ color: '#fff', width: 7 }), zIndex: 1 }),
  new Style({ stroke: new Stroke({ color: '#8f7a68', width: 4 }), zIndex: 2 }),
];
const styleVolOiseau = new Style({ stroke: new Stroke({ color: ORANGE, width: 2, lineDash: [6, 6] }) });

interface CarteMadagascarProps {
  hauteur?: number;
  depart?: Lieu | null;
  destination?: Lieu | null;
  itineraires?: Itineraire[];
  itineraireChoisi?: number;
  /** Clic sur la carte (hors itinéraire) : coordonnées du point cliqué. */
  onSelection?: (lon: number, lat: number) => void;
  /** Clic sur un itinéraire proposé. */
  onChoixItineraire?: (index: number) => void;
}

/** Carte OpenLayers de Madagascar : départ, destination et itinéraires routiers. */
export default function CarteMadagascar({
  hauteur = 320, depart, destination, itineraires = [], itineraireChoisi = 0, onSelection, onChoixItineraire,
}: CarteMadagascarProps) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carteRef = useRef<Map | null>(null);
  const sourceRef = useRef(new VectorSource());
  const rappels = useRef({ onSelection, onChoixItineraire });
  rappels.current = { onSelection, onChoixItineraire };

  // Création de la carte (une seule fois)
  useEffect(() => {
    if (!conteneur.current) return;

    const carte = new Map({
      target: conteneur.current,
      // « fond-carte » : classe utilisée pour assombrir les tuiles en mode sombre (voir global.css)
      layers: [new TileLayer({ className: 'fond-carte', source: new OSM() }), new VectorLayer({ source: sourceRef.current })],
      view: new View({ center: fromLonLat([46.87, -18.77]), zoom: 5.6, minZoom: 4.5, maxZoom: 18, extent: EMPRISE_MADAGASCAR }),
      controls: defaultControls({ rotate: false }).extend([new ScaleLine({ units: 'metric' })]),
    });

    carte.on('singleclick', (e) => {
      // Clic sur un itinéraire proposé : on le choisit
      const surItineraire = carte.forEachFeatureAtPixel(e.pixel, (f) => f.get('itineraire') as number | undefined,
        { hitTolerance: 6 });
      if (surItineraire !== undefined) {
        rappels.current.onChoixItineraire?.(surItineraire);
        return;
      }
      const [lon, lat] = toLonLat(e.coordinate);
      rappels.current.onSelection?.(lon, lat);
    });

    carte.on('pointermove', (e) => {
      const survol = carte.hasFeatureAtPixel(e.pixel, { hitTolerance: 6, layerFilter: (l) => l instanceof VectorLayer });
      carte.getViewport().style.cursor = survol ? 'pointer' : '';
    });

    carte.updateSize();
    carte.getView().fit(ILE_MADAGASCAR, { size: carte.getSize(), padding: [16, 16, 16, 16] });
    carteRef.current = carte;
    return () => carte.setTarget(undefined);
  }, []);

  // Points, itinéraires et cadrage
  useEffect(() => {
    const source = sourceRef.current;
    source.clear();
    const aCadrer: number[][] = [];

    itineraires.forEach((it, i) => {
      const coords = it.trace.map((c) => fromLonLat(c));
      const f = new Feature(new LineString(coords));
      f.set('itineraire', i);
      f.setStyle(i === itineraireChoisi ? styleItineraireRetenu : styleItineraireAutre);
      source.addFeature(f);
      aCadrer.push(...coords);
    });

    const points: number[][] = [];
    for (const [lieu, style] of [[depart, styleDepart], [destination, styleDestination]] as const) {
      if (!lieu) continue;
      const p = fromLonLat([lieu.lon, lieu.lat]);
      const f = new Feature(new Point(p));
      f.setStyle(style(lieu.nom));
      source.addFeature(f);
      points.push(p);
    }
    aCadrer.push(...points);

    // En attendant l'itinéraire (ou s'il est introuvable) : simple trait entre les deux points
    if (points.length === 2 && !itineraires.length) {
      const f = new Feature(new LineString(points));
      f.setStyle(styleVolOiseau);
      source.addFeature(f);
    }

    const carte = carteRef.current;
    if (!carte || !aCadrer.length) return;
    const vue = carte.getView();
    if (aCadrer.length === 1) {
      vue.animate({ center: aCadrer[0], zoom: Math.max(vue.getZoom() ?? 6, 9), duration: 400 });
    } else {
      vue.fit(boundingExtent(aCadrer), { padding: [56, 56, 56, 56], maxZoom: 13, duration: 400 });
    }
  }, [depart, destination, itineraires, itineraireChoisi]);

  return (
    <div
      ref={conteneur}
      className={`carte-mada${onSelection ? ' carte-mada--selection' : ''}`}
      style={{ height: hauteur }}
      role="region"
      aria-label="Carte de Madagascar"
    />
  );
}
