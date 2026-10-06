/**
 * Calcul d'itinéraires routiers via OSRM (Open Source Routing Machine, données OpenStreetMap).
 * Le serveur public de démonstration sert au développement ; en production, utiliser un OSRM
 * auto-hébergé par la DSII (ou OpenRouteService), appelé via l'API PGRI (GET /itineraires/suggestions).
 */
import Polyline from 'ol/format/Polyline';
import type LineString from 'ol/geom/LineString';
import type { Lieu } from './lieux';

export interface Itineraire {
  distanceKm: number;
  dureeMin: number;
  /** Tracé encodé (polyline, précision 6) : forme compacte à enregistrer avec la demande. */
  polyline: string;
  /** Tracé décodé en [longitude, latitude], pour l'affichage. */
  trace: [number, number][];
}

const OSRM = 'https://router.project-osrm.org';
const FORMAT_POLYLINE = new Polyline({ factor: 1e6 });

interface RouteOsrm {
  distance: number;
  duration: number;
  geometry: string;
}

function decoder(polyline: string): [number, number][] {
  const ligne = FORMAT_POLYLINE.readGeometry(polyline) as LineString;
  return ligne.getCoordinates() as [number, number][];
}

/** Itinéraires en voiture entre deux lieux, le plus court en premier (3 au maximum). */
export async function calculerItineraires(depart: Lieu, destination: Lieu, signal?: AbortSignal): Promise<Itineraire[]> {
  const points = `${depart.lon},${depart.lat};${destination.lon},${destination.lat}`;
  const params = new URLSearchParams({ overview: 'full', geometries: 'polyline6', alternatives: '3' });
  const reponse = await fetch(`${OSRM}/route/v1/driving/${points}?${params}`, { signal });
  if (!reponse.ok) throw new Error(`Calcul d'itinéraire impossible (${reponse.status})`);
  const resultat: { code: string; routes?: RouteOsrm[] } = await reponse.json();
  if (resultat.code !== 'Ok' || !resultat.routes?.length) return [];
  return resultat.routes
    .map((r) => ({
      distanceKm: Math.round(r.distance / 100) / 10,
      dureeMin: Math.round(r.duration / 60),
      polyline: r.geometry,
      trace: decoder(r.geometry),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/** « 2 h 40 », « 45 min ». */
export function formaterDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
