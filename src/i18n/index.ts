// Traductions de l'interface. Le texte français EST la clé : tr('Fermer') renvoie
// « Fermer » en français et la traduction anglaise sinon (ou le français si elle manque).
// La langue est globale (modules, widgets, notifications) ; l'app remonte l'arbre quand elle change.
import { EN } from './en';

export type Lang = 'fr' | 'en';
export type LangSetting = 'auto' | Lang;

let current: Lang = 'fr';
const listeners = new Set<(l: Lang) => void>();

/** Langue du téléphone : français si l'appareil est en français, anglais sinon. */
export function deviceLang(): Lang {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return loc.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  } catch {
    return 'fr';
  }
}

export function resolveLang(setting: LangSetting | undefined): Lang {
  return setting === 'fr' || setting === 'en' ? setting : deviceLang();
}

export function lang(): Lang {
  return current;
}

export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  listeners.forEach((f) => f(l));
}

/** Pour les modules qui gardent des tableaux traduits (mois, jours…). */
export function onLang(f: (l: Lang) => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

function fill(s: string, vars?: Record<string, string | number>) {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? `{${k}}` : String(vars[k]))) : s;
}

/** Traduit un texte français. Variables : tr('{n} min de focus', { n: 25 }). */
export function tr(fr: string, vars?: Record<string, string | number>): string {
  return fill(current === 'en' ? (EN[fr] ?? fr) : fr, vars);
}

/**
 * Pluriel : on passe les deux formes françaises (avec {n}).
 * Français : singulier pour 0 et 1 ; anglais : singulier pour 1 seulement.
 */
export function trn(n: number, one: string, many: string, vars?: Record<string, string | number>): string {
  const v = { n, ...vars };
  if (current === 'en') return fill(n === 1 ? (EN[one] ?? one) : (EN[many] ?? many), v);
  return fill(n > 1 ? many : one, v);
}

/** Locale pour toLocaleDateString / Intl. */
export function locale(): string {
  return current === 'en' ? 'en-GB' : 'fr-FR';
}
