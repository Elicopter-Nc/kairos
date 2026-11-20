import { addDays, addMonths, diffDays, fromKey } from '../lib/date';
import { CalEvent } from './types';

/** Toutes les occurrences (clés de dates) d'un événement entre from et to inclus. */
export function occurrences(ev: CalEvent, from: string, to: string): string[] {
  const out: string[] = [];
  const skip = new Set(ev.exceptions ?? []);
  const last = ev.until && ev.until < to ? ev.until : to;
  if (ev.date > last) return out;

  if (ev.recurrence === 'none') {
    if (ev.date >= from && ev.date <= to && !skip.has(ev.date)) out.push(ev.date);
    return out;
  }

  if (ev.recurrence === 'daily' || ev.recurrence === 'weekly') {
    const step = ev.recurrence === 'daily' ? 1 : 7;
    let cur = ev.date;
    if (from > ev.date) {
      const n = Math.ceil(diffDays(ev.date, from) / step);
      cur = addDays(ev.date, n * step);
    }
    while (cur <= last) {
      if (!skip.has(cur)) out.push(cur);
      cur = addDays(cur, step);
    }
    return out;
  }

  // mensuel / annuel : on avance depuis la date d'origine (en gardant le jour d'origine)
  const stepMonths = ev.recurrence === 'monthly' ? 1 : 12;
  const originDay = fromKey(ev.date).getDate();
  let i = 0;
  if (from > ev.date) {
    const a = fromKey(ev.date);
    const b = fromKey(from);
    const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    i = Math.max(0, Math.floor(months / stepMonths) - 1);
  }
  for (let guard = 0; guard < 2000; guard++, i++) {
    const cur = addMonths(ev.date, i * stepMonths);
    if (cur > last) break;
    // on ignore les mois où le jour n'existe pas (ex : 31) au lieu de décaler
    if (fromKey(cur).getDate() !== originDay) continue;
    if (cur >= from && !skip.has(cur)) out.push(cur);
  }
  return out;
}

export function occursOn(ev: CalEvent, key: string): boolean {
  return occurrences(ev, key, key).length > 0;
}

export interface Occurrence {
  event: CalEvent;
  date: string;
}

export function eventsBetween(events: CalEvent[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const ev of events) {
    for (const date of occurrences(ev, from, to)) out.push({ event: ev, date });
  }
  return out.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
    return (a.event.start ?? '') < (b.event.start ?? '') ? -1 : 1;
  });
}

export function eventsOn(events: CalEvent[], key: string): Occurrence[] {
  return eventsBetween(events, key, key);
}
