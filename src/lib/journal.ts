import type { Mood, Swatch } from '../data/types';
import { tr } from '../i18n';

// Les trois ciels du journal : une façon douce de dire comment s'est passée la journée.
// `label` est traduit à la lecture (getter) : la langue peut changer après l'import.
export const MOODS: { id: Mood; kanji: string; label: string; swatch: Swatch }[] = [
  { id: 'hare', kanji: '晴', get label() { return tr('Belle journée'); }, swatch: 'soleil' },
  { id: 'kumori', kanji: '曇', get label() { return tr('Mitigée'); }, swatch: 'menthe' },
  { id: 'ame', kanji: '雨', get label() { return tr('Difficile'); }, swatch: 'ciel' },
];

export const moodOf = (id?: Mood) => MOODS.find((m) => m.id === id);
