/* eslint-disable @typescript-eslint/no-require-imports -- chargement paresseux volontaire : le module natif n'existe pas dans Expo Go */
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { loadDB, saveDB } from '../data/storage';
import { toggleTaskIn } from '../data/tasks';
import { DB } from '../data/types';
import { resolveLang, setLang } from '../i18n';
import { cachedWeather } from '../lib/weather';
import { AgendaWidget } from './AgendaWidget';
import { NotesWidget } from './NotesWidget';
import type { Size } from './palette';
import { loadNoteChoices } from './choice';
import { TasksWidget } from './TasksWidget';
import { WeatherWidget } from './WeatherWidget';
import { AgendaWidget as AgendaV1 } from './v1/AgendaWidget';
import { NotesWidget as NotesV1 } from './v1/NotesWidget';
import { TasksWidget as TasksV1 } from './v1/TasksWidget';
import { WeatherWidget as WeatherV1 } from './v1/WeatherWidget';

export const WIDGETS = {
  tasks: 'KairosTasks',
  agenda: 'KairosAgenda',
  weather: 'KairosMeteo',
  notes: 'KairosNotes',
} as const;

/** Dessine un widget dans le style choisi (Plus → Widgets) : Simple (v1), Komorebi (v2) ou Épuré (v3). */
export async function renderFor(name: string, dbIn: DB, size?: Size & { widgetId?: number }) {
  let db = dbIn;
  // tâche de fond, sans l'interface : la langue vient des réglages
  setLang(resolveLang(db.settings.language));
  // widget Notes réglé sur une note précise : il n'affiche qu'elle (si elle existe encore)
  if (name === WIDGETS.notes && size?.widgetId != null) {
    const chosen = (await loadNoteChoices())[String(size.widgetId)];
    const note = chosen ? db.notes.find((n) => n.id === chosen) : undefined;
    if (note) db = { ...db, notes: [note] };
  }
  const style = db.settings.widgetStyle ?? 'epure';
  const weather = name === WIDGETS.weather && db.settings.weather ? await cachedWeather() : null;
  if (style === 'simple') {
    if (name === WIDGETS.agenda) return AgendaV1({ db, size });
    if (name === WIDGETS.notes) return NotesV1({ db, size });
    if (name === WIDGETS.weather) return WeatherV1({ weather, size });
    return TasksV1({ db, size });
  }
  const look = style;
  if (name === WIDGETS.agenda) return AgendaWidget({ db, size, look });
  if (name === WIDGETS.notes) return NotesWidget({ db, size, look });
  if (name === WIDGETS.weather) return WeatherWidget({ weather, size, look });
  return TasksWidget({ db, size, look });
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, widgetInfo, clickAction, clickActionData, renderWidget } = props;
  const name = widgetInfo.widgetName;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      renderWidget(await renderFor(name, await loadDB(), widgetInfo));
      break;

    case 'WIDGET_CLICK': {
      if (clickAction === 'TOGGLE_TASK' && clickActionData?.id) {
        const db = await loadDB();
        const id = String(clickActionData.id);
        // même logique que l'app : une tâche récurrente cochée crée la suivante
        const next: DB = { ...db, tasks: toggleTaskIn(db.tasks, id) };
        await saveDB(next);
        renderWidget(await renderFor(name, next, widgetInfo));
        // les autres widgets suivent, et les rappels sont recalculés
        try {
          const { refreshWidget } = require('./bridge');
          await refreshWidget();
          const { rescheduleAll } = require('../lib/notifications');
          await rescheduleAll(next);
        } catch {
          /* pas bloquant */
        }
      }
      break;
    }

    default:
      break;
  }
}
