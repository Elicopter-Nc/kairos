import * as Calendar from 'expo-calendar/legacy';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Occurrence } from '../data/recurrence';
import { useStore } from '../data/store';
import { CalEvent } from '../data/types';
import { tr } from '../i18n';
import { addDays, dateToTime, toKey } from './date';

// Lecture seule des calendriers du téléphone (Google Agenda synchronisé, Samsung…).
// On utilise l'API « legacy » d'expo-calendar : c'est la seule disponible dans Expo Go.
// Tout est lu localement, rien ne quitte le téléphone.

export const DEVICE_PREFIX = 'dev:';
export const isDeviceEvent = (id: string) => id.startsWith(DEVICE_PREFIX);

/** Occurrence venant du téléphone : couleur et nom du calendrier d'origine en plus. */
export interface DeviceOccurrence extends Occurrence {
  device: { color: string; calendarTitle: string; eventId: string; instanceStart: string };
}

export interface DeviceCalendarInfo {
  id: string;
  title: string;
  color: string;
  account: string;
}

export async function calendarPermission(ask: boolean): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') return 'denied';
  try {
    const cur = await Calendar.getCalendarPermissionsAsync();
    if (cur.granted) return 'granted';
    if (!ask) return cur.status as 'denied' | 'undetermined';
    if (!cur.canAskAgain) return 'denied';
    const res = await Calendar.requestCalendarPermissionsAsync();
    return res.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export async function listDeviceCalendars(): Promise<DeviceCalendarInfo[]> {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return cals
    .filter((c) => c.isVisible !== false)
    .map((c) => ({ id: c.id, title: c.title || c.name || tr('Calendrier'), color: c.color || '#BCD0DC', account: c.source?.name ?? '' }))
    .sort((a, b) => a.account.localeCompare(b.account) || a.title.localeCompare(b.title));
}

/** Les jours « toute la journée » sont stockés en UTC minuit : on lit la date en UTC. */
function utcKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function toOccurrences(ev: Calendar.Event, cal: DeviceCalendarInfo | undefined, from: string, to: string): DeviceOccurrence[] {
  const start = new Date(ev.startDate);
  const end = new Date(ev.endDate);
  const out: DeviceOccurrence[] = [];
  const device = {
    color: cal?.color ?? '#BCD0DC',
    calendarTitle: cal?.title ?? '',
    eventId: ev.id,
    instanceStart: start.toISOString(),
  };
  const base: Omit<CalEvent, 'id' | 'date'> = {
    title: ev.title || tr('(sans titre)'),
    allDay: !!ev.allDay,
    location: ev.location || undefined,
    color: 'ciel',
    reminder: null,
    recurrence: 'none',
    createdAt: 0,
  };

  // jours couverts par l'événement (un événement sur plusieurs jours apparaît chaque jour)
  let first: string;
  let last: string;
  if (ev.allDay) {
    first = utcKey(start);
    last = addDays(utcKey(end), -1); // fin exclusive
    if (last < first) last = first;
  } else {
    first = toKey(start);
    last = toKey(new Date(end.getTime() - 1));
    if (last < first) last = first;
  }

  for (let day = first < from ? from : first; day <= last && day <= to; day = addDays(day, 1)) {
    const single = first === last;
    const isFirst = day === first;
    const isLast = day === last;
    const allDay = ev.allDay || (!single && !isFirst && !isLast);
    out.push({
      date: day,
      event: {
        ...base,
        id: `${DEVICE_PREFIX}${ev.id}:${ev.instanceId ?? start.getTime()}:${day}`,
        date: day,
        allDay,
        start: allDay ? undefined : isFirst ? dateToTime(start) : '00:00',
        end: allDay ? undefined : isLast ? dateToTime(end) : '23:59',
      },
      device,
    });
  }
  return out;
}

// ─── Cache mémoire par plage ──────────────────────────────────────────────
const cache = new Map<string, DeviceOccurrence[]>();
let calCache: DeviceCalendarInfo[] | null = null;
const listeners = new Set<() => void>();

export function invalidateDeviceEvents() {
  cache.clear();
  calCache = null;
  listeners.forEach((l) => l());
}

async function fetchRange(ids: string[], from: string, to: string): Promise<DeviceOccurrence[]> {
  const key = `${ids.join(',')}|${from}|${to}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if ((await calendarPermission(false)) !== 'granted') return [];
  if (!calCache) calCache = await listDeviceCalendars();
  const cals = new Map(calCache.map((c) => [c.id, c]));
  const valid = ids.filter((id) => cals.has(id));
  if (!valid.length) return [];
  const start = new Date(`${from}T00:00:00`);
  start.setDate(start.getDate() - 1); // marge pour les événements « journée » en UTC
  const end = new Date(`${to}T23:59:59`);
  end.setDate(end.getDate() + 1);
  const events = await Calendar.getEventsAsync(valid, start, end);
  const occ = events
    .flatMap((ev) => toOccurrences(ev, cals.get(ev.calendarId), from, to))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
      return (a.event.start ?? '') < (b.event.start ?? '') ? -1 : 1;
    });
  cache.set(key, occ);
  return occ;
}

/** Événements des calendriers du téléphone sélectionnés, entre from et to (inclus). */
export function useDeviceEvents(from: string, to: string): DeviceOccurrence[] {
  const { db } = useStore();
  const ids = db.settings.deviceCalendars ?? [];
  const idsKey = ids.join(',');
  const [state, setState] = useState<{ key: string; occ: DeviceOccurrence[] }>({ key: '', occ: [] });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    listeners.add(bump);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') invalidateDeviceEvents();
    });
    return () => {
      listeners.delete(bump);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const key = `${idsKey}|${from}|${to}|${tick}`;
    const list = idsKey ? idsKey.split(',') : [];
    (list.length ? fetchRange(list, from, to) : Promise.resolve([] as DeviceOccurrence[]))
      .then((occ) => {
        if (alive) setState({ key, occ });
      })
      .catch(() => {
        if (alive) setState({ key, occ: [] });
      });
    return () => {
      alive = false;
    };
  }, [idsKey, from, to, tick]);

  return idsKey ? state.occ : EMPTY;
}

const EMPTY: DeviceOccurrence[] = [];

export async function openDeviceEvent(o: DeviceOccurrence) {
  try {
    await Calendar.openEventInCalendarAsync({ id: o.device.eventId, instanceStartDate: o.device.instanceStart });
  } catch {
    /* l'appli calendrier n'a pas pu s'ouvrir : on ne fait rien */
  }
}

export function asDeviceOccurrence(o: Occurrence): DeviceOccurrence | null {
  return 'device' in o ? (o as DeviceOccurrence) : null;
}
