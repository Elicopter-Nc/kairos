// Utilitaires de dates « maison » : tout est en heure locale, clés au format YYYY-MM-DD.

import { lang, onLang, tr, type Lang } from '../i18n';

// Noms des jours et des mois : tableaux exportés, remplis selon la langue (remplacés en place).
const NAMES: Record<Lang, { long: string[]; short: string[]; min: string[]; months: string[]; monthsShort: string[] }> = {
  fr: {
    long: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    short: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
    min: ['L', 'M', 'M', 'J', 'V', 'S', 'D'], // semaine qui commence lundi
    months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    monthsShort: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
  },
  en: {
    long: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    min: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  },
};

export const DAYS_LONG: string[] = [];
export const DAYS_SHORT: string[] = [];
export const DAYS_MIN: string[] = []; // semaine qui commence lundi
export const MONTHS: string[] = [];
export const MONTHS_SHORT: string[] = [];

function fillNames(l: Lang) {
  const n = NAMES[l];
  DAYS_LONG.splice(0, DAYS_LONG.length, ...n.long);
  DAYS_SHORT.splice(0, DAYS_SHORT.length, ...n.short);
  DAYS_MIN.splice(0, DAYS_MIN.length, ...n.min);
  MONTHS.splice(0, MONTHS.length, ...n.months);
  MONTHS_SHORT.splice(0, MONTHS_SHORT.length, ...n.monthsShort);
}
fillNames(lang());
onLang(fillNames);

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function addMonths(key: string, n: number): string {
  const d = fromKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toKey(d);
}

export function diffDays(a: string, b: string): number {
  // nombre de jours de a vers b
  const ms = fromKey(b).getTime() - fromKey(a).getTime();
  return Math.round(ms / 86400000);
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function dateToTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function combine(key: string, time?: string | null): Date {
  const d = fromKey(key);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d;
}

/** Lundi = 0 … dimanche = 6 */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function monthGrid(year: number, month: number): string[] {
  // 6 semaines × 7 jours, en commençant le lundi
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - mondayIndex(first));
  const out: string[] = [];
  for (let i = 0; i < 42; i++) {
    out.push(toKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }
  return out;
}

export function weekKeys(key: string): string[] {
  const d = fromKey(key);
  const start = addDays(key, -mondayIndex(d));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatLong(key: string): string {
  const d = fromKey(key);
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatShort(key: string): string {
  const d = fromKey(key);
  // « mer. 18 nov » / « Wed 18 Nov »
  return `${DAYS_SHORT[d.getDay()]}${lang() === 'en' ? '' : '.'} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function relativeLabel(key: string): string {
  const n = diffDays(todayKey(), key);
  if (n === 0) return tr("Aujourd'hui");
  if (n === 1) return tr('Demain');
  if (n === -1) return tr('Hier');
  if (n > 1 && n < 7) return DAYS_LONG[fromKey(key).getDay()].replace(/^./, (c) => c.toUpperCase());
  if (n < 0) return tr('Il y a {n} j', { n: -n });
  return formatShort(key);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return tr('Nuit blanche ?');
  if (h < 12) return tr('Bonjour');
  if (h < 18) return tr('Bon après-midi');
  return tr('Bonsoir');
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
