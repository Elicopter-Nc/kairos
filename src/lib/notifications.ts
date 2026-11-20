import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { eventsBetween } from '../data/recurrence';
import { DB } from '../data/types';
import { onLang, resolveLang, setLang, tr, trn } from '../i18n';
import { addDays, combine, todayKey } from './date';
import { leaveWindow, planLeaveAlerts } from './geo';
import { rainAlerts } from './rain';
import { cachedWeather, describe, WeatherData } from './weather';

// Stratégie : toutes les notifications sont locales. À chaque modification,
// on annule tout et on reprogramme les rappels des 21 prochains jours.
// Simple, robuste, et ça gère naturellement les événements récurrents.

const HORIZON_DAYS = 21;
const MAX_SCHEDULED = 300; // Android plafonne à ~500 alarmes par app

export const CHANNEL_REMINDERS = 'rappels';
export const CHANNEL_FOCUS = 'focus';

// Boutons dans les notifications. opensAppToForeground: true par fiabilité :
// avec false, si l'app est tuée, le listener de réponse ne reçoit rien (doc expo-notifications 58).
export const CATEGORY_TASK = 'kairos-task';
export const CATEGORY_EVENT = 'kairos-event';
export const ACTION_DONE = 'DONE';
export const ACTION_SNOOZE = 'SNOOZE';
export const SNOOZE_MINUTES = 10;

let initialized = false;

/** Canaux Android et boutons : libellés dans la langue courante (recréés quand elle change). */
async function setupChannelsAndCategories() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
      name: tr('Rappels'),
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#6F8A63',
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_FOCUS, {
      name: tr('Minuteur Focus'),
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: '#9DB58F',
    });
  }
  const snooze = tr('Dans {n} min', { n: SNOOZE_MINUTES });
  await Notifications.setNotificationCategoryAsync(CATEGORY_TASK, [
    { identifier: ACTION_DONE, buttonTitle: tr('Fait'), options: { opensAppToForeground: true } },
    { identifier: ACTION_SNOOZE, buttonTitle: snooze, options: { opensAppToForeground: true } },
  ]).catch(() => {});
  await Notifications.setNotificationCategoryAsync(CATEGORY_EVENT, [
    { identifier: ACTION_SNOOZE, buttonTitle: snooze, options: { opensAppToForeground: true } },
  ]).catch(() => {});
}

// changement de langue : on renomme canaux et boutons (s'ils ont déjà été créés)
onLang(() => {
  if (initialized) setupChannelsAndCategories().catch(() => {});
});

export async function initNotifications(): Promise<boolean> {
  if (!initialized) {
    initialized = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    await setupChannelsAndCategories();
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

interface Planned {
  at: Date;
  title: string;
  body: string;
  data: Record<string, string>;
  category?: string;
}

function plan(db: DB, weather: WeatherData | null = null): Planned[] {
  const now = Date.now();
  const from = todayKey();
  const to = addDays(from, HORIZON_DAYS);
  const out: Planned[] = [];

  // Événements (on regarde 1 jour avant pour les rappels « la veille »)
  for (const { event, date } of eventsBetween(db.events, from, addDays(to, 1))) {
    if (event.reminder === null) continue;
    const startAt = combine(date, event.allDay ? '09:00' : event.start ?? '09:00');
    const at = new Date(startAt.getTime() - event.reminder * 60000);
    if (at.getTime() <= now) continue;
    const when = event.allDay ? tr('Toute la journée') : `${event.start}${event.end ? ' → ' + event.end : ''}`;
    const lead =
      event.reminder === 0 ? tr('Maintenant') : event.reminder >= 1440 ? tr('Demain') : tr('Dans {n} min', { n: event.reminder });
    out.push({
      at,
      title: `◆ ${event.title}`,
      body: `${lead} · ${when}${event.location ? ' · ' + event.location : ''}`,
      data: { kind: 'event', id: event.id, date },
      category: CATEGORY_EVENT,
    });
  }

  // Tâches avec heure + rappel
  for (const t of db.tasks) {
    if (t.done || !t.remind || !t.due) continue;
    const at = combine(t.due, t.time ?? '09:00');
    if (at.getTime() <= now || t.due > to) continue;
    const pending = t.subtasks.filter((s) => !s.done).length;
    out.push({
      at,
      title: `☐ ${t.title}`,
      body: `${pending ? trn(pending, '{n} sous-tâche restante', '{n} sous-tâches restantes') : tr("C'est le moment")} · ${t.list}`,
      data: { kind: 'task', id: t.id },
      category: CATEGORY_TASK,
    });
  }

  // Rappels de notes
  for (const n of db.notes) {
    if (!n.remindAt) continue;
    const at = new Date(n.remindAt);
    if (isNaN(at.getTime()) || at.getTime() <= now || n.remindAt.slice(0, 10) > to) continue;
    const first = n.body.split('\n').map((l) => l.replace(/^\s*[-*]\s*\[[ xX]\]\s*/, '').trim()).find(Boolean);
    out.push({
      at,
      title: `✎ ${n.title.trim() || first || tr('Note')}`,
      body: n.title.trim() && first ? first : tr('Rappel de ta note'),
      data: { kind: 'note', id: n.id },
    });
  }

  // Alertes pluie (prévision horaire en cache, de moins de 12 h)
  if (db.settings.weather && db.settings.rainAlerts && weather) out.push(...rainAlerts(db, weather, now));

  // Brief quotidien : un résumé de la journée, calculé pour chaque jour
  if (db.settings.briefEnabled) {
    for (let i = 0; i <= Math.min(HORIZON_DAYS, 14); i++) {
      const day = addDays(from, i);
      const at = combine(day, db.settings.briefTime);
      if (at.getTime() <= now) continue;
      const evs = eventsBetween(db.events, day, day);
      const tasks = db.tasks.filter((t) => !t.done && t.due && t.due <= day);
      const parts: string[] = [];
      if (evs.length) parts.push(trn(evs.length, '{n} événement', '{n} événements'));
      if (tasks.length) parts.push(trn(tasks.length, '{n} tâche', '{n} tâches'));
      const first = evs.find((e) => !e.event.allDay) ?? evs[0];
      // météo prévue ce jour-là (dernière prévision connue, sans réseau)
      const f = weather?.daily.find((d) => d.date === day);
      const meteo = f ? `${describe(f.code).fr}, ${Math.round(f.min)}° → ${Math.round(f.max)}°${f.rain >= 50 ? tr(', parapluie') : ''}. ` : '';
      out.push({
        at,
        title: parts.length ? tr('Ta journée : {parts}', { parts: parts.join(' · ') }) : tr('Journée libre devant toi ✦'),
        body: meteo + (first
          ? first.event.start && !first.event.allDay
            ? tr('Premier rendez-vous : {title} à {time}', { title: first.event.title, time: first.event.start })
            : tr('Premier rendez-vous : {title}', { title: first.event.title })
          : tasks.length
            ? tr('À commencer : {title}', { title: tasks[0].title })
            : tr('Rien de prévu. Profites-en pour avancer sur ce qui compte.')),
        data: { kind: 'brief', date: day },
      });
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_SCHEDULED);
}

let running: Promise<void> | null = null;
let queued: DB | null = null;

export async function rescheduleAll(db: DB): Promise<void> {
  // peut tourner sans l'interface (tâche de fond, widget) : textes dans la langue choisie
  setLang(resolveLang(db.settings.language));
  // évite deux reprogrammations simultanées : on garde seulement la dernière demande
  if (running) {
    queued = db;
    return running;
  }
  running = (async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      if (!perm.granted) return;
      const weather = db.settings.weather ? await cachedWeather() : null;
      const planned = plan(db, weather);

      // « Pars maintenant » : trajet depuis la position actuelle (services OpenStreetMap)
      let keepLeave = false;
      if (db.settings.leaveAlerts) {
        const [from, to] = leaveWindow(new Date());
        const candidates = eventsBetween(db.events, from, to).filter((o) => o.event.geo && o.event.leaveAlert && !o.event.allDay);
        const leave = candidates.length ? await planLeaveAlerts(candidates, db.settings.travelMode, new Date()) : [];
        // pas de position ni de réseau (ex. en arrière-plan) : on garde les rappels déjà prévus
        keepLeave = candidates.length > 0 && leave.length === 0;
        for (const a of leave) planned.push({ at: a.at, title: a.title, body: a.body, data: { kind: 'leave', id: a.eventId, date: a.date }, category: CATEGORY_EVENT });
      }

      await cancelStale(db, keepLeave);
      for (const p of planned) {
        await Notifications.scheduleNotificationAsync({
          content: { title: p.title, body: p.body, data: p.data, sound: true, ...(p.category ? { categoryIdentifier: p.category } : {}) },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.at, channelId: CHANNEL_REMINDERS },
        });
      }
    } finally {
      running = null;
      if (queued) {
        const next = queued;
        queued = null;
        await rescheduleAll(next);
      }
    }
  })();
  return running;
}

async function cancelStale(db: DB, keepLeave = false) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const isStale = (data: Record<string, unknown> | undefined) => {
    const kind = data?.kind;
    if (kind === 'focus') return false; // minuteur en cours
    if (kind === 'leave' && keepLeave) return false; // trajet non recalculable pour l'instant
    if (kind !== 'snooze') return true; // rappel normal : sera reprogrammé
    // rappel reporté : on le garde tant que sa tâche/son événement existe encore
    if (data?.origKind === 'task') {
      const t = db.tasks.find((x) => x.id === data.id);
      return !t || t.done;
    }
    if (data?.origKind === 'event') return !db.events.some((e) => e.id === data.id);
    return false;
  };
  await Promise.all(
    all
      .filter((n) => isStale(n.content.data as Record<string, unknown> | undefined))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

// ─── Minuteur Focus ───
export async function scheduleFocusEnd(seconds: number, phase: 'focus' | 'pause'): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: phase === 'focus' ? tr('✦ Session terminée') : tr('↺ Pause terminée'),
        body: phase === 'focus' ? tr('Bien joué. Lève-toi, respire, bois un verre d’eau.') : tr('On repart pour un tour ?'),
        data: { kind: 'focus' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: CHANNEL_FOCUS,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelNotification(id: string | null) {
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

// ─── « Dans 10 min » : reporte la même notification ───
export async function snoozeNotification(content: Notifications.NotificationContent): Promise<void> {
  const data = (content.data ?? {}) as Record<string, unknown>;
  const origKind = data.kind === 'snooze' ? data.origKind : data.kind;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title ?? tr('Rappel'),
      body: content.body ?? undefined,
      data: { ...data, kind: 'snooze', origKind },
      sound: true,
      ...(content.categoryIdentifier ? { categoryIdentifier: content.categoryIdentifier } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: SNOOZE_MINUTES * 60, channelId: CHANNEL_REMINDERS },
  });
}

/** Type réel d'une notification (une notif reportée garde le type d'origine dans origKind). */
export function notificationKind(data: Record<string, unknown> | undefined): string | undefined {
  if (!data) return undefined;
  return String(data.kind === 'snooze' ? data.origKind : data.kind);
}
