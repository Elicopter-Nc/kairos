// Nettoyage des codes météo (logique pure, testable).
//
// Les modèles mettent souvent un code « bruine » (51) dès 0,1 mm calculé, même quand
// la probabilité de pluie est très faible. C'est fréquent sous les tropiques avec les
// nuages bas. Et le code quotidien d'Open-Meteo est le PIRE moment de la journée.
// On recoupe donc : quantité d'eau, probabilité et couverture nuageuse.

export const isWet = (code: number) => (code >= 51 && code <= 67) || (code >= 71 && code <= 86) || code >= 95;

/** Code « ciel » selon la couverture nuageuse (%). */
export function cloudCode(cloud: number): number {
  if (cloud < 20) return 0; // clair
  if (cloud < 50) return 1; // peu nuageux
  if (cloud < 80) return 2; // éclaircies
  return 3; // couvert
}

/**
 * Corrige un code horaire/actuel : pluie, neige ou orage seulement si la quantité
 * OU la probabilité le justifient. Sinon on garde le ciel décrit par les nuages.
 */
export function cleanCode(code: number, mm: number, prob: number | null, cloud: number): number {
  if (!isWet(code)) return code;
  const p = prob ?? 50;
  if (code >= 95) return p >= 30 || mm >= 1 ? code : cloudCode(cloud);
  if (mm >= 0.3 || (mm > 0 && p >= 40) || p >= 60) return code;
  return cloudCode(cloud);
}

export interface HourRaw {
  time: string; // YYYY-MM-DDTHH:MM (heure locale du lieu)
  code: number;
  mm: number;
  prob: number | null;
  cloud: number;
}

/**
 * Code du jour : d'après les heures de jour (7h-19h) nettoyées.
 * Pluie seulement si au moins 2 heures de jour sont vraiment pluvieuses.
 */
export function dailyCode(date: string, hours: HourRaw[], fallback: number): number {
  const day = hours.filter((h) => h.time.startsWith(date) && +h.time.slice(11, 13) >= 7 && +h.time.slice(11, 13) <= 19);
  if (!day.length) return fallback;
  const cleaned = day.map((h) => cleanCode(h.code, h.mm, h.prob, h.cloud));
  const wet = cleaned.filter(isWet);
  if (wet.length >= 2) return Math.max(...wet);
  const cloud = day.reduce((a, h) => a + h.cloud, 0) / day.length;
  return cloudCode(cloud);
}
