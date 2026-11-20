import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { rescheduleAll } from '../lib/notifications';
import { syncBackgroundTask } from '../lib/background';
import { onWeatherUpdate } from '../lib/weather';
import { addDays, todayKey, uid } from '../lib/date';
import { deletePhotos } from '../lib/photos';
import { offerUndo } from '../lib/undo';
import { tr } from '../i18n';
import { refreshWidget } from '../widget/bridge';
import { toggleTaskIn } from './tasks';
import { loadDB, normalize, saveDB } from './storage';
import { CalEvent, DB, EMPTY_DB, FocusSession, Habit, JournalEntry, Note, Settings, Task, TrashItem } from './types';

const TRASH_DAYS = 30;

interface Store {
  db: DB;
  ready: boolean;
  upsertEvent: (e: CalEvent) => void;
  deleteEvent: (id: string) => void;
  skipOccurrence: (id: string, date: string) => void;
  upsertTask: (t: Task) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  clearDone: () => void;
  reorderTasks: (orderedIds: string[]) => void;
  postponeTask: (id: string, days: number) => void;
  upsertNote: (n: Note) => void;
  deleteNote: (id: string) => void;
  upsertHabit: (h: Habit) => void;
  toggleHabit: (id: string, date: string) => void;
  deleteHabit: (id: string) => void;
  addFocus: (s: FocusSession) => void;
  updateSettings: (p: Partial<Settings>) => void;
  replaceAll: (raw: unknown) => void;
  restoreFromTrash: (trashId: string) => void;
  setJournal: (date: string, patch: Partial<Omit<JournalEntry, 'date'>>) => void;
  deleteForever: (trashId: string) => void;
  emptyTrash: () => void;
  reload: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...list];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(EMPTY_DB);
  const [ready, setReady] = useState(false);
  const dirty = useRef(false);

  const reload = useCallback(async () => {
    const loaded = await loadDB();
    dirty.current = false;
    setDb(loaded);
    setReady(true);
  }, []);

  useEffect(() => {
    loadDB().then((loaded) => {
      // corbeille : ce qui a plus de 30 jours part pour de bon (avec ses photos)
      const limit = Date.now() - TRASH_DAYS * 86400000;
      const old = loaded.trash.filter((x) => x.deletedAt < limit);
      if (old.length) {
        deletePhotos(old.flatMap((x) => (x.kind === 'note' ? x.item.photos ?? [] : [])));
        dirty.current = true;
        loaded = { ...loaded, trash: loaded.trash.filter((x) => x.deletedAt >= limit) };
      }
      setDb(loaded);
      setReady(true);
    });
  }, []);

  // Quand on revient dans l'app, on relit le stockage : une tâche a peut-être été cochée depuis le widget.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && !dirty.current) reload();
    });
    return () => sub.remove();
  }, [reload]);

  // Sauvegarde + notifications + widget, regroupés (debounce)
  useEffect(() => {
    if (!ready || !dirty.current) return;
    const save = setTimeout(() => {
      saveDB(db)
        .then(() => {
          dirty.current = false;
          return refreshWidget();
        })
        .catch((e) => console.warn('Sauvegarde impossible', e));
    }, 250);
    const notif = setTimeout(() => {
      rescheduleAll(db).catch((e) => console.warn('Notifications', e));
    }, 1200);
    return () => {
      clearTimeout(save);
      clearTimeout(notif);
    };
  }, [db, ready]);

  // Au démarrage : on (re)programme une fois les rappels
  // Nouvelle prévision météo → on recalcule les alertes pluie / départ
  const dbRef = useRef(db);
  useEffect(() => {
    dbRef.current = db;
  }, [db]);
  useEffect(
    () =>
      onWeatherUpdate(() => {
        if (!ready) return;
        rescheduleAll(dbRef.current).catch(() => {});
        refreshWidget(); // le widget météo suit
      }),
    [ready],
  );

  // tâche de fond (APK) : active dès que la météo l'est (alertes pluie, widget météo)
  const bgWanted = db.settings.weather;
  useEffect(() => {
    if (ready) syncBackgroundTask(dbRef.current.settings);
  }, [ready, bgWanted]);

  useEffect(() => {
    if (ready) rescheduleAll(db).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const mutate = useCallback((fn: (d: DB) => DB) => {
    dirty.current = true;
    setDb((d) => fn(d));
  }, []);

  /** Met un élément à la corbeille et propose « Annuler ». */
  const trash = useCallback(
    (entry: Omit<TrashItem, 'id' | 'deletedAt'>, label: string, apply: (d: DB) => DB) => {
      const id = uid();
      const item = { ...entry, id, deletedAt: Date.now() } as TrashItem;
      mutate((d) => ({ ...apply(d), trash: [item, ...d.trash].slice(0, 500) }));
      offerUndo(label, id);
    },
    [mutate],
  );

  const store = useMemo<Store>(
    () => ({
      db,
      ready,
      reload,
      upsertEvent: (e) => mutate((d) => ({ ...d, events: upsert(d.events, e) })),
      deleteEvent: (id) => {
        const ev = db.events.find((e) => e.id === id);
        if (!ev) return;
        trash({ kind: 'event', item: ev }, tr('Événement supprimé'), (d) => ({
          ...d,
          events: d.events.filter((e) => e.id !== id),
          // on garde les notes et tâches, mais on coupe le lien
          notes: d.notes.map((n) => (n.eventId === id ? { ...n, eventId: undefined, eventDate: undefined } : n)),
          tasks: d.tasks.map((t) => (t.eventId === id ? { ...t, eventId: undefined } : t)),
        }));
      },
      skipOccurrence: (id, date) =>
        mutate((d) => ({
          ...d,
          events: d.events.map((e) => (e.id === id ? { ...e, exceptions: [...(e.exceptions ?? []), date] } : e)),
        })),
      upsertTask: (t) => mutate((d) => ({ ...d, tasks: upsert(d.tasks, t) })),
      toggleTask: (id) => mutate((d) => ({ ...d, tasks: toggleTaskIn(d.tasks, id) })),
      deleteTask: (id) => {
        const t = db.tasks.find((x) => x.id === id);
        if (t) trash({ kind: 'task', item: t }, tr('Tâche supprimée'), (d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== id) }));
      },
      clearDone: () =>
        mutate((d) => {
          const now = Date.now();
          const gone: TrashItem[] = d.tasks.filter((t) => t.done).map((t) => ({ id: uid(), deletedAt: now, kind: 'task', item: t }));
          return { ...d, tasks: d.tasks.filter((t) => !t.done), trash: [...gone, ...d.trash].slice(0, 500) };
        }),
      reorderTasks: (orderedIds) =>
        mutate((d) => {
          const rank = new Map(orderedIds.map((id, i) => [id, i]));
          return { ...d, tasks: d.tasks.map((t) => (rank.has(t.id) ? { ...t, order: rank.get(t.id) } : t)) };
        }),
      postponeTask: (id, days) =>
        mutate((d) => ({
          ...d,
          tasks: d.tasks.map((t) => {
            if (t.id !== id) return t;
            const base = t.due && t.due > todayKey() ? t.due : todayKey();
            return { ...t, due: addDays(base, days) };
          }),
        })),
      upsertNote: (n) => mutate((d) => ({ ...d, notes: upsert(d.notes, n) })),
      deleteNote: (id) => {
        const n = db.notes.find((x) => x.id === id);
        if (n) trash({ kind: 'note', item: n }, tr('Note supprimée'), (d) => ({ ...d, notes: d.notes.filter((x) => x.id !== id) }));
      },
      upsertHabit: (h) => mutate((d) => ({ ...d, habits: upsert(d.habits, h) })),
      toggleHabit: (id, date) =>
        mutate((d) => ({
          ...d,
          habits: d.habits.map((h) =>
            h.id !== id ? h : { ...h, log: h.log.includes(date) ? h.log.filter((x) => x !== date) : [...h.log, date] },
          ),
        })),
      deleteHabit: (id) => mutate((d) => ({ ...d, habits: d.habits.filter((h) => h.id !== id) })),
      addFocus: (s) => mutate((d) => ({ ...d, focus: [...d.focus, s].slice(-2000) })),
      updateSettings: (p) => mutate((d) => ({ ...d, settings: { ...d.settings, ...p } })),
      replaceAll: (raw) => mutate(() => normalize(raw)),
      setJournal: (date, patch) =>
        mutate((d) => {
          const cur = d.journal.find((j) => j.date === date) ?? { date };
          const next = { ...cur, ...patch };
          const rest = d.journal.filter((j) => j.date !== date);
          const empty = !next.mood && !next.text?.trim();
          return { ...d, journal: empty ? rest : [...rest, next].sort((a, b) => a.date.localeCompare(b.date)) };
        }),
      restoreFromTrash: (trashId) =>
        mutate((d) => {
          const x = d.trash.find((y) => y.id === trashId);
          if (!x) return d;
          const rest = d.trash.filter((y) => y.id !== trashId);
          if (x.kind === 'note') return { ...d, trash: rest, notes: upsert(d.notes, x.item) };
          if (x.kind === 'task') return { ...d, trash: rest, tasks: upsert(d.tasks, x.item) };
          return { ...d, trash: rest, events: upsert(d.events, x.item) };
        }),
      deleteForever: (trashId) =>
        mutate((d) => {
          const x = d.trash.find((y) => y.id === trashId);
          if (x?.kind === 'note') deletePhotos(x.item.photos);
          return { ...d, trash: d.trash.filter((y) => y.id !== trashId) };
        }),
      emptyTrash: () =>
        mutate((d) => {
          deletePhotos(d.trash.flatMap((x) => (x.kind === 'note' ? x.item.photos ?? [] : [])));
          return { ...d, trash: [] };
        }),
    }),
    [db, ready, mutate, reload, trash],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore hors du StoreProvider');
  return s;
}

export const newId = uid;
