import type { DB } from '../data/types';
import { toKey } from './date';

// 庭 — le jardin de l'année : un point par jour, plus ou moins feuillu selon
// ce qui a été fait ce jour-là (tâches, focus, rituels, journal).

export interface DayScore {
  tasks: number;
  focus: number; // minutes
  rituals: number;
  journal: boolean;
  score: number;
}

export function gardenOf(db: DB, year: number): Map<string, DayScore> {
  const m = new Map<string, DayScore>();
  const get = (k: string) => {
    let d = m.get(k);
    if (!d) m.set(k, (d = { tasks: 0, focus: 0, rituals: 0, journal: false, score: 0 }));
    return d;
  };
  const inYear = (k: string) => k.startsWith(`${year}-`);
  for (const t of db.tasks) {
    if (!t.done || !t.doneAt) continue;
    const k = toKey(new Date(t.doneAt));
    if (inYear(k)) get(k).tasks++;
  }
  for (const f of db.focus) if (inYear(f.date)) get(f.date).focus += f.minutes;
  for (const h of db.habits) for (const k of h.log) if (inYear(k)) get(k).rituals++;
  for (const j of db.journal) if (inYear(j.date) && (j.mood || j.text)) get(j.date).journal = true;
  for (const d of m.values()) d.score = d.tasks + d.focus / 25 + d.rituals + (d.journal ? 1 : 0);
  return m;
}

/** 0 à 4 : niveau de feuillage. */
export function levelOf(score: number): number {
  if (score <= 0) return 0;
  if (score < 2) return 1;
  if (score < 4) return 2;
  if (score < 7) return 3;
  return 4;
}
