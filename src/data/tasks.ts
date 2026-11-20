import { addDays, todayKey, uid } from '../lib/date';
import { tr } from '../i18n';
import type { Task, TaskRepeat } from './types';

// Logique pure des tâches (partagée par l'app, le widget et les notifications).

function addMonths(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, last)); // 31 janv. + 1 mois = 28/29 févr.
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

export function step(key: string, r: TaskRepeat): string {
  const n = Math.max(1, Math.round(r.every));
  if (r.unit === 'day') return addDays(key, n);
  if (r.unit === 'week') return addDays(key, 7 * n);
  if (r.unit === 'month') return addMonths(key, n);
  return addMonths(key, 12 * n);
}

/** Prochaine échéance : un pas après l'échéance actuelle, sans tomber dans le passé. */
export function nextDue(due: string | undefined, r: TaskRepeat, today = todayKey()): string {
  let next = step(due ?? today, r);
  for (let i = 0; next < today && i < 1000; i++) next = step(next, r);
  return next;
}

export function repeatLabel(r: TaskRepeat): string {
  const n = Math.max(1, Math.round(r.every));
  if (r.unit === 'day') return n === 1 ? tr('Tous les jours') : tr('Tous les {n} jours', { n });
  if (r.unit === 'week') return n === 1 ? tr('Toutes les semaines') : tr('Toutes les {n} semaines', { n });
  if (r.unit === 'month') return n === 1 ? tr('Tous les mois') : tr('Tous les {n} mois', { n });
  return n === 1 ? tr('Tous les ans') : tr('Tous les {n} ans', { n });
}

/**
 * Coche / décoche une tâche. Pour une tâche récurrente cochée, crée la suivante
 * (mêmes réglages, étapes décochées). Décocher supprime la suivante si elle n'a
 * pas encore été faite.
 */
export function toggleTaskIn(tasks: Task[], id: string, now = Date.now()): Task[] {
  const t = tasks.find((x) => x.id === id);
  if (!t) return tasks;
  if (!t.done) {
    let out = tasks.map((x) => (x.id === id ? { ...x, done: true, doneAt: now } : x));
    if (t.repeat && !t.spawnedId) {
      const next: Task = {
        ...t,
        id: uid(),
        done: false,
        doneAt: undefined,
        spawnedId: undefined,
        due: nextDue(t.due, t.repeat),
        subtasks: t.subtasks.map((s) => ({ ...s, done: false })),
        createdAt: now,
      };
      out = [...out.map((x) => (x.id === id ? { ...x, spawnedId: next.id } : x)), next];
    }
    return out;
  }
  const spawned = t.spawnedId ? tasks.find((x) => x.id === t.spawnedId) : undefined;
  return tasks
    .filter((x) => !(spawned && x.id === spawned.id && !spawned.done))
    .map((x) => (x.id === id ? { ...x, done: false, doneAt: undefined, spawnedId: spawned && !spawned.done ? undefined : x.spawnedId } : x));
}
