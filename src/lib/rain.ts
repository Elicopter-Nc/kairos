import { eventsBetween } from '../data/recurrence';
import type { DB } from '../data/types';
import { tr } from '../i18n';
import { addDays, combine, todayKey } from './date';
import type { WeatherData } from './weather';

// Logique pure (testable) des alertes pluie : aucune dépendance native ici.

export interface RainAlert {
  at: Date;
  title: string;
  body: string;
  data: Record<string, string>;
}

const RAIN = 60; // % de probabilité à partir duquel on prévient

/** Heure locale « YYYY-MM-DDTHH:MM » de la prévision → Date du téléphone. */
const forecastDate = (s: string) => combine(s.slice(0, 10), s.slice(11, 16));

/**
 * Pluie : (1) prévient ~45 min avant le début d'un épisode de pluie dans les 12 h,
 * (2) prévient 1 h avant un événement (avec horaire) pendant lequel il devrait pleuvoir.
 */
export function rainAlerts(db: DB, weather: WeatherData, now: number): RainAlert[] {
  if (now - weather.fetchedAt > 12 * 3600 * 1000) return [];
  const out: RainAlert[] = [];
  const hours = weather.hourly.map((h) => ({ ...h, at: forecastDate(h.time) })).filter((h) => h.at.getTime() > now - 3600 * 1000);

  // (1) débuts d'épisodes de pluie (au plus 2)
  let episodes = 0;
  for (let i = 0; i < hours.length && episodes < 2; i++) {
    const h = hours[i];
    if (h.at.getTime() - now > 12 * 3600 * 1000) break;
    const before = i > 0 ? hours[i - 1].rain : 0;
    if (h.rain >= RAIN && before < RAIN) {
      const at = new Date(h.at.getTime() - 45 * 60000);
      if (at.getTime() > now + 60000) {
        out.push({
          at,
          title: tr('Pluie probable vers {h} h', { h: h.time.slice(11, 13) }),
          body: tr('{p} % de risque. Pense au parapluie si tu sors.', { p: h.rain }),
          data: { kind: 'rain', time: h.time },
        });
      }
      episodes++;
    }
  }

  // (2) événements des prochaines 24 h sous la pluie
  const today = todayKey();
  for (const { event, date } of eventsBetween(db.events, today, addDays(today, 1))) {
    if (event.allDay || !event.start) continue;
    const start = combine(date, event.start);
    const slot = hours.find((h) => Math.abs(h.at.getTime() - start.getTime()) < 30 * 60000);
    if (!slot || slot.rain < RAIN) continue;
    const at = new Date(start.getTime() - 60 * 60000);
    if (at.getTime() <= now + 60000) continue;
    out.push({
      at,
      title: tr('Pluie prévue pour « {title} »', { title: event.title }),
      body: event.location
        ? tr('{p} % de risque à {time} · {place}. Prévois un parapluie.', { p: slot.rain, time: event.start, place: event.location })
        : tr('{p} % de risque à {time}. Prévois un parapluie.', { p: slot.rain, time: event.start }),
      data: { kind: 'rain', id: event.id, date },
    });
  }
  return out;
}

