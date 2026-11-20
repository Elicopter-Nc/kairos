import type { Priority, Recurrence } from '../data/types';
import { addDays, addMonths, dateToTime, fromKey, mondayIndex, timeToMinutes, toKey } from './date';

// Saisie naturelle en français, 100 % locale.
// « dentiste demain 14h30 » → événement demain à 14:30
// « appeler maman vendredi 18h ! #perso » → tâche vendredi, rappel 18:00, priorité haute
// « anniversaire de Léa le 12 mars tous les ans » → événement annuel, journée entière

export interface Parsed {
  title: string;
  kind: 'task' | 'event';
  date?: string;
  start?: string;
  end?: string;
  recurrence: Recurrence;
  priority: Priority;
  list?: string;
  location?: string;
  /** Morceaux reconnus (pour l'aperçu sous le champ) */
  found: string[];
}

const L = 'a-zà-öø-ÿœæ0-9'; // caractères de « mot » (lettres accentuées comprises)
const B = `(^|[^${L}])`; // frontière avant (groupe capturant, Hermes n'aime pas tous les lookbehind)
const E = `(?![${L}])`; // frontière après

const DAYS: Record<string, number> = { lundi: 0, mardi: 1, mercredi: 2, jeudi: 3, vendredi: 4, samedi: 5, dimanche: 6 };
const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, février: 2, fevrier: 2, févr: 2, fevr: 2, fév: 2, mars: 3, avril: 4, avr: 4, mai: 5, juin: 6,
  juillet: 7, juil: 7, août: 8, aout: 8, septembre: 9, sept: 9, octobre: 10, oct: 10, novembre: 11, nov: 11, décembre: 12, decembre: 12, déc: 12, dec: 12,
};
const NUM_WORDS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, quinze: 15 };
const EVENT_WORDS = [
  'rdv', 'rendez-vous', 'rendez vous', 'réunion', 'reunion', 'meeting', 'dîner', 'diner', 'déjeuner', 'dejeuner', 'apéro', 'apero', 'cours',
  'match', 'concert', 'cinéma', 'cinema', 'ciné', 'anniversaire', 'anniv', 'dentiste', 'médecin', 'medecin', 'docteur', 'kiné', 'kine', 'coiffeur',
  'entretien', 'soirée', 'soiree', 'fête', 'fete', 'mariage', 'vol', 'train', 'visio', 'call', 'séance', 'seance', 'spectacle', 'expo', 'vacances',
];

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (h: number, m = 0) => `${pad(Math.min(23, h))}:${pad(Math.min(59, m))}`;

export function parseQuick(input: string, now = new Date(), lists: string[] = []): Parsed {
  const src = input;
  const low = input.toLowerCase();
  const spans: [number, number][] = [];
  const found: string[] = [];
  const today = toKey(now);
  let date: string | undefined;
  let start: string | undefined;
  let end: string | undefined;
  let recurrence: Recurrence = 'none';
  let priority: Priority = 0;
  let list: string | undefined;
  let location: string | undefined;
  let dayPart: string | undefined; // matin / soir… si pas d'heure précise

  /** Cherche un motif (après frontière B) ; renvoie le match et marque la plage à retirer du titre. */
  const take = (pattern: string, flags = 'i'): RegExpExecArray | null => {
    const re = new RegExp(`${B}(${pattern})${E}`, flags);
    const m = re.exec(low);
    if (!m) return null;
    const s = m.index + m[1].length;
    const e = s + m[2].length;
    if (spans.some(([a, b]) => s < b && e > a)) return null; // déjà utilisé
    spans.push([s, e]);
    return m;
  };

  // ── Récurrence ──
  let m: RegExpExecArray | null;
  if ((m = take('(?:tous les|chaque) (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?'))) {
    recurrence = 'weekly';
    const target = DAYS[m[3]];
    const diff = (target - mondayIndex(now) + 7) % 7;
    date = addDays(today, diff);
    found.push(`chaque ${m[3]}`);
  } else if ((m = take('tous les jours|chaque jour|quotidiennement|tous les matins|tous les soirs'))) {
    recurrence = 'daily';
    if (m[2].includes('matin')) dayPart = 'matin';
    if (m[2].includes('soir')) dayPart = 'soir';
    found.push('chaque jour');
  } else if ((m = take('toutes les semaines|chaque semaine|hebdo'))) {
    recurrence = 'weekly';
    found.push('chaque semaine');
  } else if ((m = take('tous les mois|chaque mois|mensuel'))) {
    recurrence = 'monthly';
    found.push('chaque mois');
  } else if ((m = take('tous les ans|chaque année|chaque annee|annuel'))) {
    recurrence = 'yearly';
    found.push('chaque année');
  }

  // ── Priorité, liste, lieu ──
  if ((m = new RegExp(`(^|\\s)(!!+)(?=\\s|$)`).exec(low))) {
    const s = m.index + m[1].length;
    spans.push([s, s + m[2].length]);
    priority = 2;
    found.push('urgent');
  } else if ((m = new RegExp(`(^|\\s)(!)(?=\\s|$)`).exec(low))) {
    const s = m.index + m[1].length;
    spans.push([s, s + 1]);
    priority = 1;
    found.push('prioritaire');
  }
  if ((m = new RegExp(`(^|\\s)#([${L}_-]+)`, 'i').exec(low))) {
    const name = m[2];
    const match = lists.find((l) => l.toLowerCase() === name);
    if (match) {
      const s = m.index + m[1].length;
      spans.push([s, s + name.length + 1]);
      list = match;
      found.push(`#${match}`);
    }
  }
  if ((m = /(^|\s)@([^\s#!]+(?: [^\s#!@]+)?)/.exec(src))) {
    // un ou deux mots après @ (s'arrête avant un mot-clé de date/heure)
    let place = m[2];
    const cut = place.split(' ');
    if (cut.length > 1 && /^(\d|à|a|le|demain|aujourd|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|de|ce|cet|cette|dans)/i.test(cut[1])) place = cut[0];
    const s = m.index + m[1].length;
    spans.push([s, s + place.length + 1]);
    location = place;
    found.push(`@${place}`);
  }

  // ── Plage horaire « de 14h à 16h » / « 9h-10h30 » ──
  const T = '(\\d{1,2})\\s*(?:h|:|heures?)\\s*(\\d{2})?';
  if ((m = take(`(?:de |entre )?${T}\\s*(?:-|–|à|a|et|jusqu'à)\\s*${T}`))) {
    start = hm(+m[3], m[4] ? +m[4] : 0);
    end = hm(+m[5], m[6] ? +m[6] : 0);
    found.push(`${start} → ${end}`);
  }
  // ── Heure seule ──
  if (!start && (m = take(`(?:à |a |vers )?${T}`))) {
    const h = +m[3];
    if (h <= 23) {
      start = hm(h, m[4] ? +m[4] : 0);
      found.push(start);
    } else spans.pop();
  }
  if (!start && (m = take('(?:à |a )?midi'))) {
    start = '12:00';
    found.push('12:00');
  }
  if (!start && (m = take('(?:à |a )?minuit'))) {
    start = '00:00';
    found.push('00:00');
  }
  // ── Durée « pendant 2h » / « pendant 30 min » ──
  if ((m = take('pendant (\\d+)\\s*(h|heures?|min|minutes?)(\\d{2})?'))) {
    const n = +m[3];
    const mins = m[4].startsWith('h') ? n * 60 + (m[5] ? +m[5] : 0) : n;
    if (start) {
      const t = Math.min(timeToMinutes(start) + mins, 23 * 60 + 59);
      end = hm(Math.floor(t / 60), t % 60);
    }
    found.push(`${mins} min`);
  }

  // ── Dates relatives ──
  if (!date) {
    if ((m = take("aujourd'hui|aujourd’hui|auj"))) {
      date = today;
      found.push("aujourd'hui");
    } else if ((m = take('après-demain|apres-demain|après demain|apres demain'))) {
      date = addDays(today, 2);
      found.push('après-demain');
    } else if ((m = take('demain'))) {
      date = addDays(today, 1);
      found.push('demain');
    } else if ((m = take('ce soir|cette nuit'))) {
      date = today;
      dayPart = 'soir';
      found.push('ce soir');
    } else if ((m = take('ce matin'))) {
      date = today;
      dayPart = 'matin';
      found.push('ce matin');
    } else if ((m = take('cet après-midi|cet apres-midi|cet aprem'))) {
      date = today;
      dayPart = 'aprem';
      found.push('cet après-midi');
    } else if ((m = take('ce week-end|ce weekend|ce we'))) {
      date = addDays(today, (5 - mondayIndex(now) + 7) % 7);
      found.push('ce week-end');
    } else if ((m = take('la semaine prochaine|semaine prochaine'))) {
      date = addDays(today, 7 - mondayIndex(now));
      found.push('semaine prochaine');
    } else if ((m = take('le mois prochain|mois prochain'))) {
      const d = fromKey(addMonths(today, 1));
      d.setDate(1);
      date = toKey(d);
      found.push('mois prochain');
    } else if ((m = take(`dans (\\d+|${Object.keys(NUM_WORDS).join('|')}) (jours?|semaines?|mois|heures?|h|minutes?|min)`))) {
      const n = /\d/.test(m[3]) ? +m[3] : NUM_WORDS[m[3]];
      const unit = m[4];
      if (unit.startsWith('jour')) date = addDays(today, n);
      else if (unit.startsWith('semaine')) date = addDays(today, n * 7);
      else if (unit === 'mois') date = addMonths(today, n);
      else {
        const t = new Date(now.getTime() + n * (unit.startsWith('h') ? 3600000 : 60000));
        date = toKey(t);
        start = start ?? dateToTime(t);
      }
      found.push(`dans ${n} ${unit}`);
    } else if ((m = take('(?:le |ce |cette )?(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?: prochain| qui vient)?'))) {
      const target = DAYS[m[3]];
      let diff = (target - mondayIndex(now) + 7) % 7;
      if (diff === 0 || m[2].includes('prochain')) diff = diff === 0 ? 7 : diff;
      date = addDays(today, diff);
      found.push(m[3]);
    }
  }
  // demi-journée après un jour (« demain soir », « vendredi matin »)
  if (!dayPart && (m = take('matin|soir|après-midi|apres-midi|aprem|midi'))) {
    dayPart = m[2].startsWith('mat') ? 'matin' : m[2] === 'soir' ? 'soir' : m[2] === 'midi' ? 'midi' : 'aprem';
  }

  // ── Dates absolues ──
  if (!date) {
    if ((m = take('(?:le )?(\\d{1,2})[/.-](\\d{1,2})(?:[/.-](\\d{2,4}))?'))) {
      date = absolute(+m[3], +m[4], m[5] ? +m[5] : undefined, now);
      if (date) found.push(fmt(date));
      else spans.pop();
    } else if ((m = take(`(?:le )?(\\d{1,2}|1er) (${Object.keys(MONTHS).join('|')})\\.?(?: (\\d{4}))?`))) {
      const day = m[3] === '1er' ? 1 : +m[3];
      date = absolute(day, MONTHS[m[4]], m[5] ? +m[5] : undefined, now);
      if (date) found.push(fmt(date));
      else spans.pop();
    } else if ((m = take('le (\\d{1,2}|1er)'))) {
      const day = m[3] === '1er' ? 1 : +m[3];
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      if (d.getDate() === day) {
        if (toKey(d) < today) d.setMonth(d.getMonth() + 1);
        date = toKey(d);
        found.push(fmt(date));
      } else spans.pop();
    }
  }

  if (!start && dayPart) start = { matin: '09:00', midi: '12:00', aprem: '14:00', soir: '19:00' }[dayPart];
  if (start && !date) {
    // une heure sans jour : aujourd'hui si elle n'est pas passée, sinon demain
    date = timeToMinutes(start) > now.getHours() * 60 + now.getMinutes() ? today : addDays(today, 1);
  }
  if (recurrence !== 'none' && !date) date = today;

  // ── Titre = texte d'origine moins les morceaux reconnus ──
  // un mot de liaison juste avant un morceau reconnu part avec lui (« à 11h », « le 1er », « pour demain »)
  for (const sp of spans) {
    const before = low.slice(0, sp[0]);
    const lk = /(^|\s)(à|a|le|la|de|du|pour|au|vers|ce|cette|dès|des)\s+$/.exec(before);
    if (lk) sp[0] = lk.index + lk[1].length;
  }
  spans.sort((a, b) => a[0] - b[0]);
  let title = '';
  let pos = 0;
  for (const [a, b] of spans) {
    title += src.slice(pos, a) + ' ';
    pos = Math.max(pos, b);
  }
  title += src.slice(pos);
  title = title
    .replace(/\s+/g, ' ')
    .replace(/(^|\s)(à|a|le|la|les|de|du|pour|au|ce|et|-|,)(?=\s*$)/gi, '') // mot de liaison laissé en fin
    .trim()
    .replace(/[,\-–:]+$/, '')
    .trim();
  if (title) title = title.charAt(0).toUpperCase() + title.slice(1);

  const isEventWord = EVENT_WORDS.some((w) => new RegExp(`${B}${w.replace('-', '\\-')}${E}`, 'i').test(low));
  const kind: 'task' | 'event' = recurrence !== 'none' || !!end || isEventWord ? 'event' : 'task';

  return { title: title || src.trim(), kind, date, start, end, recurrence, priority, list, location, found };
}

function absolute(day: number, month: number, year: number | undefined, now: Date): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  let y = year ?? now.getFullYear();
  if (y < 100) y += 2000;
  const d = new Date(y, month - 1, day);
  if (d.getMonth() !== month - 1) return undefined;
  if (!year && toKey(d) < toKey(now)) d.setFullYear(y + 1);
  return toKey(d);
}

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function fmt(key: string) {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
