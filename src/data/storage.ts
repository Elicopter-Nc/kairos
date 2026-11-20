import AsyncStorage from '@react-native-async-storage/async-storage';
import { DB, DEFAULT_SETTINGS, EMPTY_DB } from './types';

// Tout tient dans une seule clé JSON : simple, 100 % hors-ligne, et lisible
// aussi par le widget Android (qui tourne dans un contexte JS « headless »).
const KEY = 'kairos:db:v1';

export function normalize(raw: unknown): DB {
  const r = (raw ?? {}) as Partial<DB>;
  return {
    version: 1,
    events: Array.isArray(r.events) ? r.events : [],
    tasks: Array.isArray(r.tasks) ? r.tasks.map((t) => ({ ...t, subtasks: t.subtasks ?? [] })) : [],
    notes: Array.isArray(r.notes) ? r.notes : [],
    habits: Array.isArray(r.habits) ? r.habits : [],
    focus: Array.isArray(r.focus) ? r.focus : [],
    trash: Array.isArray(r.trash) ? r.trash : [],
    journal: Array.isArray(r.journal) ? r.journal : [],
    settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) },
  };
}

export async function loadDB(): Promise<DB> {
  try {
    const s = await AsyncStorage.getItem(KEY);
    return s ? normalize(JSON.parse(s)) : EMPTY_DB;
  } catch (e) {
    console.warn('Lecture des données impossible', e);
    return EMPTY_DB;
  }
}

export async function saveDB(db: DB): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(db));
}
