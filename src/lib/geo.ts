import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import type { Occurrence } from '../data/recurrence';
import { lang, tr } from '../i18n';
import { addDays, combine, toKey } from './date';

// Lieux et trajets via les services OpenStreetMap (gratuits, sans clé).
// Règles d'usage respectées : User-Agent générique, requêtes rares et mises en cache,
// pas plus d'une recherche par seconde sur Nominatim. Aucune donnée personnelle envoyée
// en dehors du texte du lieu cherché et de positions arrondies (~100 m).

export const OSM_HEADERS = {
  'User-Agent': 'KairosApp/1.2 (app personnelle)',
  // noms de lieux dans la langue de l'interface
  get 'Accept-Language'() {
    return lang();
  },
};

export type TravelMode = 'car' | 'bike' | 'foot';
// libellés traduits à la lecture (getters) : la langue peut changer après l'import
export const MODE_LABEL: Record<TravelMode, string> = {
  get car() { return tr('en voiture'); },
  get bike() { return tr('à vélo'); },
  get foot() { return tr('à pied'); },
};

export interface Place {
  lat: number;
  lon: number;
  label: string; // court, pour le champ Lieu
  detail: string; // adresse complète, pour la liste de suggestions
}

export interface LatLon {
  lat: number;
  lon: number;
}

// ─── Géocodage (Nominatim) ──────────────────────────────────────────────────
let lastSearch = 0;
const searchCache = new Map<string, Place[]>();

export async function searchPlaces(q: string): Promise<Place[]> {
  const query = q.trim();
  if (query.length < 3) return [];
  const key = query.toLowerCase();
  const hit = searchCache.get(key);
  if (hit) return hit;
  // 1 requête par seconde au maximum
  const wait = 1000 - (Date.now() - lastSearch);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSearch = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&accept-language=fr&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: OSM_HEADERS });
  if (!res.ok) throw new Error(tr('Recherche de lieu impossible ({status})', { status: res.status }));
  type Row = { lat: string; lon: string; name?: string; display_name: string; address?: Record<string, string> };
  const json = (await res.json()) as Row[];
  const places: Place[] = json.map((r) => {
    const a = r.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county;
    const street = [a.house_number, a.road].filter(Boolean).join(' ');
    const base = r.name || street || r.display_name.split(',')[0].trim();
    const label = city && city !== base ? `${base}, ${city}` : base;
    return { lat: +r.lat, lon: +r.lon, label, detail: r.display_name };
  });
  searchCache.set(key, places);
  return places;
}

// ─── Position actuelle (arrondie) ───────────────────────────────────────────
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export async function currentPositionRounded(ask = false): Promise<LatLon | null> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 });
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: round3(pos.coords.latitude), lon: round3(pos.coords.longitude) };
  } catch {
    return null;
  }
}

// ─── Temps de trajet (OSRM sur routing.openstreetmap.de) ────────────────────
const ROUTE_TTL = 6 * 60 * 60 * 1000;
const ROUTE_KEY = 'kairos:routes';
const routeMem = new Map<string, { at: number; minutes: number }>();
let routeLoaded = false;

async function loadRoutes() {
  if (routeLoaded) return;
  routeLoaded = true;
  try {
    const s = await AsyncStorage.getItem(ROUTE_KEY);
    if (s) for (const [k, v] of Object.entries(JSON.parse(s) as Record<string, { at: number; minutes: number }>)) routeMem.set(k, v);
  } catch {}
}

async function saveRoutes() {
  const now = Date.now();
  const obj: Record<string, { at: number; minutes: number }> = {};
  for (const [k, v] of routeMem) if (now - v.at < ROUTE_TTL) obj[k] = v;
  await AsyncStorage.setItem(ROUTE_KEY, JSON.stringify(obj)).catch(() => {});
}

export async function routeMinutes(from: LatLon, to: LatLon, mode: TravelMode): Promise<number | null> {
  await loadRoutes();
  const key = `${mode}:${round3(from.lat)},${round3(from.lon)}>${round3(to.lat)},${round3(to.lon)}`;
  const hit = routeMem.get(key);
  if (hit && Date.now() - hit.at < ROUTE_TTL) return hit.minutes;
  try {
    const url = `https://routing.openstreetmap.de/routed-${mode}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
    const res = await fetch(url, { headers: OSM_HEADERS });
    if (!res.ok) return hit?.minutes ?? null;
    const json = (await res.json()) as { code: string; routes?: { duration: number }[] };
    if (json.code !== 'Ok' || !json.routes?.length) return hit?.minutes ?? null;
    const minutes = Math.max(1, Math.round(json.routes[0].duration / 60));
    routeMem.set(key, { at: Date.now(), minutes });
    saveRoutes();
    return minutes;
  } catch {
    return hit?.minutes ?? null; // hors-ligne : dernière valeur connue, même périmée
  }
}

// ─── Tuiles « slippy map » ──────────────────────────────────────────────────
/** Position en tuiles (fractionnaire) d'un point au zoom z. */
export function toTile(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x, y };
}

export function tileUrl(x: number, y: number, z: number) {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

// ─── Rappels « pars maintenant » ────────────────────────────────────────────
export interface LeaveAlert {
  eventId: string;
  date: string;
  at: Date;
  minutes: number;
  title: string;
  body: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Pour chaque occurrence (non « journée entière ») qui commence dans les 24 prochaines heures,
 * avec un lieu géocodé et `leaveAlert` activé : heure de départ = début − trajet − 5 min.
 * Position demandée une seule fois. Hors-ligne ou sans permission : [] (jamais d'exception).
 */
export async function planLeaveAlerts(events: Occurrence[], mode: TravelMode, now: Date): Promise<LeaveAlert[]> {
  try {
    const limit = now.getTime() + 24 * 60 * 60 * 1000;
    const candidates = events.filter((o) => {
      if (o.event.allDay || !o.event.start || !o.event.geo || !o.event.leaveAlert) return false;
      const t = combine(o.date, o.event.start).getTime();
      return t > now.getTime() && t <= limit;
    });
    if (!candidates.length) return [];
    const here = await currentPositionRounded(false);
    if (!here) return [];
    const out: LeaveAlert[] = [];
    for (const o of candidates) {
      const geo = o.event.geo!;
      const minutes = await routeMinutes(here, { lat: geo.lat, lon: geo.lon }, mode);
      if (minutes === null) continue;
      const start = combine(o.date, o.event.start!);
      const at = new Date(start.getTime() - (minutes + 5) * 60000);
      if (at.getTime() <= now.getTime()) continue;
      out.push({
        eventId: o.event.id,
        date: o.date,
        at,
        minutes,
        title: tr('Pars maintenant pour {title}', { title: o.event.title }),
        body: tr('{n} min {mode} · arrivée prévue à {time}', { n: minutes, mode: MODE_LABEL[mode], time: `${pad(start.getHours())}:${pad(start.getMinutes())}` }),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Plage de dates à passer à eventsBetween pour planLeaveAlerts (aujourd'hui et demain). */
export function leaveWindow(now: Date): [string, string] {
  const today = toKey(now);
  return [today, addDays(today, 1)];
}
