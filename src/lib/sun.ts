// Lever et coucher du soleil calculés sur le téléphone (algorithme NOAA simplifié,
// précision ~1-2 min). Sert à caler la lumière komorebi sur le vrai soleil, même
// hors-ligne, à partir de la dernière position connue de la météo.

const rad = Math.PI / 180;

/** Heures de lever/coucher (Date locales) pour la date et la position données. null si jour/nuit polaire. */
export function sunTimes(date: Date, lat: number, lon: number): { sunrise: Date; sunset: Date } | null {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000);
  const g = ((2 * Math.PI) / 365) * (day - 1); // angle fractionnaire de l'année (midi)
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = (Math.cos(90.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)) / (Math.cos(lat * rad) * Math.cos(decl));
  if (cosH > 1 || cosH < -1) return null;
  const ha = Math.acos(cosH) / rad; // en degrés
  const riseUTC = 720 - 4 * (lon + ha) - eqTime; // minutes depuis minuit UTC
  const setUTC = 720 - 4 * (lon - ha) - eqTime;
  const base = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return { sunrise: new Date(base + riseUTC * 60000), sunset: new Date(base + setUTC * 60000) };
}

/** Heures décimales locales (ex. 7.5 = 7h30). */
export const hoursOf = (d: Date) => d.getHours() + d.getMinutes() / 60;
