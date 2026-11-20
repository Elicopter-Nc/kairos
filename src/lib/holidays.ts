import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useStore } from '../data/store';
import { tr } from '../i18n';
import { addDays, diffDays } from './date';

// Jours fériés (calendrier.api.gouv.fr) et vacances scolaires (data.education.gouv.fr).
// Données publiques : aucune information personnelle n'est envoyée, seulement la zone.
// Téléchargées au plus une fois par semaine (ou quand la zone change), puis lues
// depuis le cache : tout reste visible hors-ligne.

// Les identifiants sont stockés ; les libellés sont traduits à la lecture (getter).
export const FERIES_ZONES: { id: string; label: string }[] = [
  { id: 'metropole', get label() { return tr('Métropole'); } },
  { id: 'alsace-moselle', label: 'Alsace-Moselle' },
  { id: 'guadeloupe', label: 'Guadeloupe' },
  { id: 'guyane', get label() { return tr('Guyane'); } },
  { id: 'la-reunion', get label() { return tr('La Réunion'); } },
  { id: 'martinique', label: 'Martinique' },
  { id: 'mayotte', label: 'Mayotte' },
  { id: 'nouvelle-caledonie', get label() { return tr('Nouvelle-Calédonie'); } },
  { id: 'polynesie-francaise', get label() { return tr('Polynésie française'); } },
  { id: 'saint-barthelemy', get label() { return tr('Saint-Barthélemy'); } },
  { id: 'saint-martin', get label() { return tr('Saint-Martin'); } },
  { id: 'saint-pierre-et-miquelon', get label() { return tr('Saint-Pierre-et-Miquelon'); } },
  { id: 'wallis-et-futuna', get label() { return tr('Wallis-et-Futuna'); } },
];

export const VACANCES_ZONES: { id: string; label: string }[] = [
  { id: 'Zone A', label: 'Zone A' },
  { id: 'Zone B', label: 'Zone B' },
  { id: 'Zone C', label: 'Zone C' },
  { id: 'Corse', get label() { return tr('Corse'); } },
  { id: 'Guadeloupe', label: 'Guadeloupe' },
  { id: 'Guyane', get label() { return tr('Guyane'); } },
  { id: 'Martinique', label: 'Martinique' },
  { id: 'Mayotte', label: 'Mayotte' },
  { id: 'Nouvelle Calédonie', get label() { return tr('Nouvelle-Calédonie'); } },
  { id: 'Polynésie', get label() { return tr('Polynésie'); } },
  { id: 'Réunion', get label() { return tr('La Réunion'); } },
  { id: 'Saint Pierre et Miquelon', get label() { return tr('Saint-Pierre-et-Miquelon'); } },
  { id: 'Wallis et Futuna', get label() { return tr('Wallis-et-Futuna'); } },
];

export const feriesLabel = (id: string | null) => FERIES_ZONES.find((z) => z.id === id)?.label ?? tr('Masqués');
export const vacancesLabel = (id: string | null) => VACANCES_ZONES.find((z) => z.id === id)?.label ?? tr('Masquées');

/** Nom d'un jour férié ou de vacances (texte des API publiques, en français) dans la langue de l'interface. */
export const holidayName = (name: string) => tr(name);

export interface Vacation {
  name: string;
  start: string; // premier jour (YYYY-MM-DD)
  end: string; // dernier jour inclus
}

interface Cache {
  feries?: { zone: string; fetchedAt: number; days: Record<string, string> };
  vacances?: { zone: string; fetchedAt: number; list: Vacation[] };
}

const KEY = 'kairos:holidays';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

let cache: Cache = {};
let loaded = false;
let loading = false;
let error: string | null = null;
const subs = new Set<() => void>();
let snapshot: { cache: Cache; loading: boolean; error: string | null } = { cache, loading, error };
const emit = () => {
  snapshot = { cache, loading, error };
  subs.forEach((f) => f());
};

async function loadCache() {
  if (loaded) return;
  loaded = true;
  try {
    const s = await AsyncStorage.getItem(KEY);
    if (s) {
      cache = JSON.parse(s);
      emit();
    }
  } catch {}
}

/**
 * Les dates du ministère sont des minuits (heure de Paris) exprimés en UTC,
 * ex. « 2026-10-16T22:00:00+00:00 » = samedi 17 octobre. On décale de 12 h avant
 * de prendre la date UTC : correct pour tous les fuseaux de -12 h à +11 h.
 */
function isoToKey(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 12 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

async function fetchFeries(zone: string): Promise<Record<string, string>> {
  const res = await fetch(`https://calendrier.api.gouv.fr/jours-feries/${zone}.json`);
  if (!res.ok) throw new Error(tr('Jours fériés : erreur {status}', { status: res.status }));
  return res.json();
}

async function fetchVacances(zone: string): Promise<Vacation[]> {
  const since = addDays(new Date().toISOString().slice(0, 10), -400);
  const where = encodeURIComponent(`zones="${zone}" and end_date>="${since}"`);
  const url =
    'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records' +
    `?where=${where}&group_by=description,start_date,end_date,population&order_by=start_date&limit=100`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(tr('Vacances scolaires : erreur {status}', { status: res.status }));
  const j = await res.json();
  const rows: { description: string; start_date: string; end_date: string; population?: string }[] = j.results ?? [];
  const seen = new Map<string, Vacation>();
  for (const r of rows) {
    // les dates « Enseignants » diffèrent parfois de celles des élèves : on garde les élèves
    if (r.population === 'Enseignants') continue;
    const start = isoToKey(r.start_date);
    // end_date = jour de reprise des cours → le dernier jour de vacances est la veille
    let end = addDays(isoToKey(r.end_date), -1);
    if (end < start) end = start; // ex. « Début des vacances d'été » (une seule date)
    const name = r.description.trim();
    const k = `${name}|${start}`;
    const prev = seen.get(k);
    if (!prev || end > prev.end) seen.set(k, { name, start, end });
  }
  return [...seen.values()].sort((a, b) => a.start.localeCompare(b.start));
}

export async function refreshHolidays(feries: string | null, vacances: string | null, force = false): Promise<void> {
  await loadCache();
  if (loading) return;
  const now = Date.now();
  const needF = !!feries && (force || cache.feries?.zone !== feries || now - (cache.feries?.fetchedAt ?? 0) > MAX_AGE);
  const needV = !!vacances && (force || cache.vacances?.zone !== vacances || now - (cache.vacances?.fetchedAt ?? 0) > MAX_AGE);
  if (!needF && !needV) return;
  loading = true;
  error = null;
  emit();
  try {
    const next: Cache = { ...cache };
    const errs: string[] = [];
    if (needF && feries) {
      try {
        next.feries = { zone: feries, fetchedAt: now, days: await fetchFeries(feries) };
      } catch (e) {
        errs.push(e instanceof Error ? e.message : tr('Jours fériés indisponibles'));
      }
    }
    if (needV && vacances) {
      try {
        next.vacances = { zone: vacances, fetchedAt: now, list: await fetchVacances(vacances) };
      } catch (e) {
        errs.push(e instanceof Error ? e.message : tr('Vacances indisponibles'));
      }
    }
    cache = next;
    if (errs.length) error = tr('{errors} (hors-ligne ?)', { errors: errs.join(' · ') });
    await AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => {});
  } finally {
    loading = false;
    emit();
  }
}

export interface HolidaysState {
  feries: Map<string, string>;
  vacances: Vacation[];
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  holidayOn: (key: string) => string | undefined;
  vacationOn: (key: string) => Vacation | undefined;
  refresh: () => Promise<void>;
}

/** Jours fériés et vacances de la zone choisie (cache + rafraîchissement hebdomadaire). */
export function useHolidays(): HolidaysState {
  const { db } = useStore();
  const { feries: zf, vacances: zv } = db.settings.holidays ?? { feries: null, vacances: null };
  const snap = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => snapshot,
  );
  useEffect(() => {
    loadCache().then(() => refreshHolidays(zf, zv));
  }, [zf, zv]);

  return useMemo(() => {
    const c = snap.cache;
    // noms traduits ici, à l'affichage (le cache garde le texte des API)
    const feries = new Map<string, string>(zf && c.feries?.zone === zf ? Object.entries(c.feries.days).map(([k, v]) => [k, holidayName(v)]) : []);
    const vacances = zv && c.vacances?.zone === zv ? c.vacances.list.map((v) => ({ ...v, name: holidayName(v.name) })) : [];
    const times = [zf ? c.feries?.fetchedAt : undefined, zv ? c.vacances?.fetchedAt : undefined].filter((x): x is number => !!x);
    return {
      feries,
      vacances,
      loading: snap.loading,
      error: snap.error,
      updatedAt: times.length ? Math.min(...times) : null,
      holidayOn: (key: string) => feries.get(key),
      vacationOn: (key: string) => vacances.find((v) => key >= v.start && key <= v.end),
      refresh: () => refreshHolidays(zf, zv, true),
    };
  }, [snap, zf, zv]);
}

/** Prochain jour férié à partir de `from` (inclus), dans les `within` jours. */
export function nextHoliday(feries: Map<string, string>, from: string, within = 14): { date: string; name: string; inDays: number } | null {
  let best: string | null = null;
  for (const k of feries.keys()) if (k >= from && (!best || k < best)) best = k;
  if (!best) return null;
  const inDays = diffDays(from, best);
  if (inDays > within) return null;
  return { date: best, name: feries.get(best)!, inDays };
}
