import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { IconName } from '../components/ui';
import { tr } from '../i18n';
import { cleanCode, dailyCode, HourRaw } from './weatherClean';

// Météo via Open-Meteo (gratuit, sans compte, sans clé).
// - La position est arrondie à 2 décimales (~1 km) avant d'être envoyée.
// - La dernière réponse est gardée sur le téléphone : hors-ligne, on affiche
//   la dernière météo connue avec son heure de mise à jour.

export type Sky = 'clair' | 'voile' | 'couvert' | 'brouillard' | 'bruine' | 'pluie' | 'neige' | 'orage';

export interface WeatherData {
  fetchedAt: number;
  lat: number;
  lon: number;
  place?: string;
  current: { time: string; temp: number; feels: number; code: number; wind: number; humidity: number; isDay: boolean };
  hourly: { time: string; temp: number; code: number; rain: number }[];
  daily: { date: string; code: number; max: number; min: number; rain: number; sunrise: string; sunset: string; uv: number }[];
}

interface Desc {
  fr: string; // libellé affiché, déjà traduit dans la langue de l'interface
  kanji: string;
  sky: Sky;
  icon: IconName;
}

export function describe(code: number, isDay = true): Desc {
  if (code === 0) return { fr: isDay ? tr('Grand soleil') : tr('Nuit claire'), kanji: '晴', sky: 'clair', icon: isDay ? 'sun' : 'moon' };
  if (code === 1) return { fr: isDay ? tr('Plutôt ensoleillé') : tr('Nuit dégagée'), kanji: '晴', sky: 'clair', icon: isDay ? 'sun' : 'moon' };
  if (code === 2) return { fr: tr('Éclaircies'), kanji: '薄曇', sky: 'voile', icon: 'cloud' };
  if (code === 3) return { fr: tr('Couvert'), kanji: '曇', sky: 'couvert', icon: 'cloud' };
  if (code === 45 || code === 48) return { fr: tr('Brouillard'), kanji: '霧', sky: 'brouillard', icon: 'align-justify' };
  if (code >= 51 && code <= 57) return { fr: tr('Bruine'), kanji: '霧雨', sky: 'bruine', icon: 'cloud-drizzle' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    const strong = code === 65 || code === 67 || code === 82;
    return { fr: strong ? tr('Forte pluie') : code >= 80 ? tr('Averses') : tr('Pluie'), kanji: '雨', sky: 'pluie', icon: 'cloud-rain' };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { fr: tr('Neige'), kanji: '雪', sky: 'neige', icon: 'cloud-snow' };
  if (code >= 95) return { fr: tr('Orage'), kanji: '雷', sky: 'orage', icon: 'cloud-lightning' };
  return { fr: tr('Variable'), kanji: '天', sky: 'voile', icon: 'cloud' };
}

/** Une phrase courte dans l'esprit de l'app, selon le temps qu'il fait. */
export function weatherLine(w: WeatherData): string {
  const d = describe(w.current.code, w.current.isDay);
  const today = w.daily[0];
  const rainLater = w.hourly.slice(0, 12).find((h) => h.rain >= 60);
  if (d.sky === 'orage') return tr('Orage en vue. Une journée pour rester à l’abri et avancer au calme.');
  if (d.sky === 'pluie' || d.sky === 'bruine') return tr('La pluie tombe. Bon moment pour une session de focus.');
  if (d.sky === 'neige') return tr('Il neige. Le monde ralentit, toi aussi tu peux.');
  if (d.sky === 'brouillard') return tr('Brume sur le paysage. Avance pas à pas.');
  if (rainLater) return tr('Pluie probable vers {h} h. Prends un parapluie.', { h: rainLater.time.slice(11, 13) });
  if (today && today.uv >= 8) return tr('Soleil fort aujourd’hui. Pense à l’ombre et à boire.');
  if (d.sky === 'clair') return w.current.isDay ? tr('Belle lumière à travers les feuilles aujourd’hui.') : tr('Ciel dégagé. Belle nuit pour lever les yeux.');
  return tr('Ciel doux et voilé. Une journée tranquille.');
}

// ─── Petit magasin global (cache + abonnés) ─────────────────────────────────
const KEY = 'kairos:weather:v2'; // v2 : codes corrigés (voir weatherClean.ts)
const MAX_AGE = 45 * 60 * 1000;
let data: WeatherData | null = null;
let loading = false;
let error: string | null = null;
let loaded = false;
const subs = new Set<() => void>();
let snapshot: { data: WeatherData | null; loading: boolean; error: string | null } = { data, loading, error };
const emit = () => {
  snapshot = { data, loading, error };
  subs.forEach((f) => f());
};

async function loadCache() {
  if (loaded) return;
  loaded = true;
  try {
    const s = await AsyncStorage.getItem(KEY);
    if (s) {
      data = JSON.parse(s);
      emit();
    }
  } catch {}
}

const round = (n: number) => Math.round(n * 100) / 100;

async function position(): Promise<{ lat: number; lon: number } | null> {
  let perm = await Location.getForegroundPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return null;
  const last = await Location.getLastKnownPositionAsync({ maxAge: 3 * 60 * 60 * 1000 });
  const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
  return { lat: round(pos.coords.latitude), lon: round(pos.coords.longitude) };
}

async function placeName(lat: number, lon: number): Promise<string | undefined> {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    return a?.city ?? a?.district ?? a?.subregion ?? a?.region ?? undefined;
  } catch {
    return data?.place;
  }
}

const updateListeners = new Set<(w: WeatherData) => void>();
/** Appelé à chaque nouvelle prévision reçue (pour reprogrammer les alertes pluie, etc.). */
export function onWeatherUpdate(cb: (w: WeatherData) => void): () => void {
  updateListeners.add(cb);
  return () => updateListeners.delete(cb);
}

/**
 * Rafraîchit la météo. `cachedPosition` : réutilise la dernière position connue
 * (aucun accès GPS) — utilisé par la tâche de fond.
 */
export async function refreshWeather(force = false, cachedPosition = false): Promise<WeatherData | null> {
  await loadCache();
  if (loading) return data;
  if (!force && data && Date.now() - data.fetchedAt < MAX_AGE) return data;
  if (cachedPosition && !data) return null;
  loading = true;
  error = null;
  emit();
  try {
    const pos = cachedPosition && data ? { lat: data.lat, lon: data.lon } : await position();
    if (!pos) throw new Error(tr('Autorise la localisation pour afficher la météo.'));
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}` +
      '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day,precipitation,cloud_cover' +
      '&hourly=temperature_2m,weather_code,precipitation_probability,precipitation,cloud_cover' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max' +
      '&timezone=auto&forecast_days=7';
    const res = await fetch(url);
    if (!res.ok) throw new Error(tr('Open-Meteo a répondu {status}', { status: res.status }));
    const j = await res.json();
    const nowHour = String(j.current.time).slice(0, 13);
    const start = Math.max(0, (j.hourly.time as string[]).findIndex((t) => t.slice(0, 13) === nowHour));
    // toutes les heures des 7 jours, avec de quoi corriger les codes (voir weatherClean.ts)
    const raw: HourRaw[] = (j.hourly.time as string[]).map((time, i) => ({
      time,
      code: j.hourly.weather_code[i],
      mm: j.hourly.precipitation?.[i] ?? 0,
      prob: j.hourly.precipitation_probability?.[i] ?? null,
      cloud: j.hourly.cloud_cover?.[i] ?? 50,
    }));
    const next: WeatherData = {
      fetchedAt: Date.now(),
      lat: pos.lat,
      lon: pos.lon,
      place: data && data.lat === pos.lat && data.lon === pos.lon ? data.place : await placeName(pos.lat, pos.lon),
      current: {
        time: j.current.time,
        temp: j.current.temperature_2m,
        feels: j.current.apparent_temperature,
        code: cleanCode(j.current.weather_code, j.current.precipitation ?? 0, raw[start]?.prob ?? null, j.current.cloud_cover ?? 50),
        wind: j.current.wind_speed_10m,
        humidity: j.current.relative_humidity_2m,
        isDay: j.current.is_day === 1,
      },
      hourly: (j.hourly.time as string[]).slice(start, start + 24).map((time, i) => ({
        time,
        temp: j.hourly.temperature_2m[start + i],
        code: cleanCode(raw[start + i].code, raw[start + i].mm, raw[start + i].prob, raw[start + i].cloud),
        rain: j.hourly.precipitation_probability[start + i] ?? 0,
      })),
      daily: (j.daily.time as string[]).map((date, i) => ({
        date,
        code: dailyCode(date, raw, j.daily.weather_code[i]),
        max: j.daily.temperature_2m_max[i],
        min: j.daily.temperature_2m_min[i],
        rain: j.daily.precipitation_probability_max[i] ?? 0,
        sunrise: j.daily.sunrise[i],
        sunset: j.daily.sunset[i],
        uv: j.daily.uv_index_max[i] ?? 0,
      })),
    };
    data = next;
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    updateListeners.forEach((cb) => cb(next));
    return next;
  } catch (e) {
    error = e instanceof Error ? e.message : tr('Météo indisponible');
    return data;
  } finally {
    loading = false;
    emit();
  }
}

export async function clearWeather() {
  data = null;
  error = null;
  await AsyncStorage.removeItem(KEY).catch(() => {});
  emit();
}

/** Dernière météo connue, sans réseau (pour le brief du matin, le widget…). */
export async function cachedWeather(): Promise<WeatherData | null> {
  await loadCache();
  return data;
}

/** Hook : météo en cache + rafraîchissement automatique si activée. */
export function useWeather(enabled: boolean) {
  const snap = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => snapshot,
  );
  useEffect(() => {
    loadCache();
    if (!enabled) return;
    refreshWeather();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshWeather();
    });
    return () => sub.remove();
  }, [enabled]);
  return { ...snap, data: enabled ? snap.data : null, refresh: () => refreshWeather(true) };
}

export function ageLabel(ts: number): string {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 2) return tr('à l’instant');
  if (min < 60) return tr('il y a {n} min', { n: min });
  const h = Math.round(min / 60);
  if (h < 24) return tr('il y a {n} h', { n: h });
  return tr('il y a {n} j', { n: Math.round(h / 24) });
}

/** Données de plus de 3 h : on signale qu'on est hors-ligne. */
export function isStale(ts: number): boolean {
  return Date.now() - ts > 3 * 60 * 60 * 1000;
}

/** Plus forte probabilité de pluie entre maintenant et minuit (pas celle de toute la journée). */
export function rainUntilTonight(w: WeatherData): number {
  const today = w.current.time.slice(0, 10);
  return w.hourly.filter((h) => h.time.startsWith(today)).reduce((m, h) => Math.max(m, h.rain), 0);
}
