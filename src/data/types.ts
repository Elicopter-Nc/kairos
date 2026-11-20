export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type Priority = 0 | 1 | 2; // normale, haute, urgente
export type ThemeMode = 'auto' | 'jour' | 'nuit';

/** v1 = Simple (aplat), v2 = Komorebi (décor complet), v3 = Épuré. */
export type WidgetStyle = 'simple' | 'komorebi' | 'epure';

export type Swatch = 'tomate' | 'citron' | 'lilas' | 'ciel' | 'menthe' | 'soleil' | 'rose' | 'encre';

export interface CalEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (première occurrence)
  allDay: boolean;
  start?: string; // HH:MM
  end?: string; // HH:MM
  location?: string;
  description?: string;
  color: Swatch;
  reminder: number | null; // minutes avant, null = pas de rappel
  recurrence: Recurrence;
  until?: string; // fin de récurrence (incluse)
  geo?: { lat: number; lon: number; label: string; query: string }; // lieu géocodé (cache, query = texte du lieu)
  leaveAlert?: boolean; // rappel « pars maintenant » selon le trajet
  exceptions?: string[]; // occurrences supprimées
  createdAt: number;
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  done: boolean;
  doneAt?: number;
  due?: string; // YYYY-MM-DD
  time?: string; // HH:MM -> rappel à cette heure
  remind: boolean;
  priority: Priority;
  list: string; // nom de la liste (Perso, Pro…)
  eventId?: string;
  subtasks: Subtask[];
  order?: number; // ordre manuel (glisser-déposer), plus petit = plus haut
  tags?: string[]; // tags libres partagés avec les notes
  repeat?: TaskRepeat; // tâche récurrente : la suivante se crée quand on coche
  spawnedId?: string; // id de la tâche suivante créée en cochant (pour annuler si on décoche)
  createdAt: number;
}

export interface TaskRepeat {
  every: number; // 1, 2, 3…
  unit: 'day' | 'week' | 'month' | 'year';
}

export interface Note {
  id: string;
  title: string;
  body: string;
  color: Swatch;
  pinned: boolean;
  eventId?: string;
  eventDate?: string; // occurrence précise liée (utile pour les événements récurrents)
  photos?: string[]; // URI de fichiers locaux (dossier documents de l'app)
  tags?: string[]; // tags libres, en minuscules, sans « # »
  remindAt?: string; // rappel ponctuel « YYYY-MM-DDTHH:MM »
  createdAt: number;
  updatedAt: number;
}

/** Journal : une humeur (ciel) et une ligne par jour. */
export type Mood = 'hare' | 'kumori' | 'ame';
export interface JournalEntry {
  date: string; // YYYY-MM-DD
  mood?: Mood;
  text?: string;
}

/** Élément supprimé, gardé 30 jours dans la corbeille. */
export type TrashItem = { id: string; deletedAt: number } & (
  | { kind: 'note'; item: Note }
  | { kind: 'task'; item: Task }
  | { kind: 'event'; item: CalEvent }
);

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: Swatch;
  log: string[]; // dates (YYYY-MM-DD) où l'habitude a été faite
  createdAt: number;
}

export interface FocusSession {
  date: string;
  minutes: number;
}

export interface Settings {
  theme: ThemeMode;
  briefEnabled: boolean;
  briefTime: string; // HH:MM
  lists: string[];
  focusMinutes: number;
  breakMinutes: number;
  name: string;
  onboarded: boolean;
  ambiance: boolean; // lumière komorebi animée (désactivable pour la batterie)
  hemisphere: 'nord' | 'sud'; // décale les saisons (particules, micro-saisons)
  weather: boolean; // météo Open-Meteo activée (position arrondie envoyée)
  deviceCalendars: string[]; // id des calendriers du téléphone affichés dans Kairos
  holidays: { feries: string | null; vacances: string | null }; // zone jours fériés (ex. 'metropole') et vacances scolaires (ex. 'Zone A'), null = masqué
  rainAlerts: boolean; // notification « pluie prévue » (météo requise)
  travelMode: 'car' | 'bike' | 'foot'; // mode pour le temps de trajet
  leaveAlerts: boolean; // rappels « pars maintenant » pour les événements avec lieu
  linkPreviews: boolean; // aperçu des liens collés dans les notes
  widgetStyle: WidgetStyle; // apparence des widgets de l'écran d'accueil
  updateCheck: boolean; // vérifier sur GitHub si une nouvelle version de l'APK existe
  seasonal: boolean; // couleur d'accent qui suit la saison
  focusSound: 'aucun' | 'pluie' | 'ruisseau'; // ambiance sonore pendant le Focus
  focusBell: boolean; // cloche à la fin de chaque phase
  language: 'auto' | 'fr' | 'en'; // langue de l'interface (auto = celle du téléphone)
}

export interface DB {
  version: 1;
  events: CalEvent[];
  tasks: Task[];
  notes: Note[];
  habits: Habit[];
  focus: FocusSession[];
  trash: TrashItem[];
  journal: JournalEntry[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  briefEnabled: true,
  briefTime: '07:30',
  lists: ['Perso', 'Pro', 'Courses'],
  focusMinutes: 25,
  breakMinutes: 5,
  name: '',
  onboarded: false,
  ambiance: true,
  hemisphere: 'nord',
  weather: false,
  deviceCalendars: [],
  holidays: { feries: null, vacances: null },
  rainAlerts: true,
  travelMode: 'car',
  leaveAlerts: false,
  linkPreviews: true,
  widgetStyle: 'epure',
  updateCheck: true,
  seasonal: false,
  focusSound: 'aucun',
  focusBell: true,
  language: 'auto',
};

export const EMPTY_DB: DB = {
  version: 1,
  events: [],
  tasks: [],
  notes: [],
  habits: [],
  focus: [],
  trash: [],
  journal: [],
  settings: DEFAULT_SETTINGS,
};

export const REMINDER_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Aucun', value: null },
  { label: "À l'heure", value: 0 },
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 h', value: 60 },
  { label: '1 jour', value: 1440 },
];

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Une fois',
  daily: 'Chaque jour',
  weekly: 'Chaque semaine',
  monthly: 'Chaque mois',
  yearly: 'Chaque année',
};
