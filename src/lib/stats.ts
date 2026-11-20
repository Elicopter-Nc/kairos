import { Habit } from '../data/types';
import { tr } from '../i18n';
import { addDays, todayKey } from './date';

/** Série en cours : jours consécutifs jusqu'à aujourd'hui (ou hier si pas encore fait aujourd'hui). */
export function streak(h: Habit): number {
  const set = new Set(h.log);
  let day = todayKey();
  if (!set.has(day)) day = addDays(day, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(h: Habit): number {
  const sorted = [...h.log].sort();
  let best = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    cur = prev && addDays(prev, 1) === d ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

export function dayProgress(): number {
  const n = new Date();
  return (n.getHours() * 60 + n.getMinutes()) / 1440;
}

export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Petites pensées locales, tirées selon le jour de l'année (traduites à l'affichage).
const THOUGHTS = [
  'Kairos : le moment opportun. Pas le temps qui passe, celui qu’on saisit.',
  'Une seule chose importante aujourd’hui suffit à faire une bonne journée.',
  'Ce qui est noté n’encombre plus la tête.',
  'Commence par la tâche que tu repousses depuis trois jours.',
  'Le calendrier dit quand. La liste dit quoi. Toi seul sais pourquoi.',
  'Fait vaut mieux que parfait.',
  'Protège tes matinées comme des rendez-vous.',
  'Une pause n’est pas du temps perdu, c’est de l’élan en réserve.',
  'Range une chose, finis une chose, appelle quelqu’un.',
  'Petits pas, longue série.',
  'Dis non à ce qui ne compte pas pour dire oui à ce qui compte.',
  'Le meilleur moment pour commencer, c’est maintenant.',
];

export function thoughtOfDay(): string {
  const n = new Date();
  const start = new Date(n.getFullYear(), 0, 0);
  const doy = Math.floor((n.getTime() - start.getTime()) / 86400000);
  return tr(THOUGHTS[doy % THOUGHTS.length]);
}
