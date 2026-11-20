import { Skia, SkImage, SkTypefaceFontProvider, TextAlign } from '@shopify/react-native-skia';
import type { DB, JournalEntry } from '../../data/types';
import { tr, trn } from '../../i18n';
import { addDays, capitalize, DAYS_LONG, fromKey, MONTHS, todayKey } from '../date';
import { gardenOf } from '../garden';
import { moodOf } from '../journal';
import { currentMicroSeason, seasonOf } from '../seasons';

// Les pages du livre-journal : une par jour, depuis le premier jour écrit
// (et au moins les 30 derniers jours), jusqu'à aujourd'hui.
// Chaque page est dessinée une fois en image (Skia), puis le shader de pli la fait tourner.

export interface BookPage {
  date: string;
  entry?: JournalEntry;
  tasks: number;
  focus: number;
  rituals: number;
  number: number;
}

export function bookPages(db: DB): BookPage[] {
  const today = todayKey();
  const written = db.journal.filter((j) => j.mood || j.text?.trim()).map((j) => j.date).sort();
  let start = addDays(today, -30);
  if (written[0] && written[0] < start) start = written[0];
  const sorted: string[] = [];
  for (let d = start; d <= today && sorted.length < 800; d = addDays(d, 1)) sorted.push(d);
  const years = new Map<number, ReturnType<typeof gardenOf>>();
  return sorted.map((date, i) => {
    const y = Number(date.slice(0, 4));
    if (!years.has(y)) years.set(y, gardenOf(db, y));
    const g = years.get(y)!.get(date);
    return { date, entry: db.journal.find((j) => j.date === date), tasks: g?.tasks ?? 0, focus: g?.focus ?? 0, rituals: g?.rituals ?? 0, number: i + 1 };
  });
}

const KANJI_DAY = ['日', '月', '火', '水', '木', '金', '土'];
const PAPER = '#F3F1E4';
const INK = '#2E372D';
const MUTED = '#8A917E';
const RULE = '#DCDDCB';
const HANKO = '#B8412F';

function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function text(fonts: SkTypefaceFontProvider, str: string, family: string, size: number, color: string, width: number, align = TextAlign.Left, lineHeight = 1.4) {
  const p = Skia.ParagraphBuilder.Make({ textAlign: align }, fonts)
    .pushStyle({ color: Skia.Color(color), fontFamilies: [family], fontSize: size, heightMultiplier: lineHeight })
    .addText(str)
    .build();
  p.layout(width);
  return p;
}

/** Dessine une page du journal et la renvoie en image (taille en pixels réels). */
export function renderPage(page: BookPage, w: number, h: number, scale: number, fonts: SkTypefaceFontProvider, hemisphere: 'nord' | 'sud'): SkImage | null {
  const surface = Skia.Surface.MakeOffscreen(Math.round(w * scale), Math.round(h * scale));
  if (!surface) return null;
  const c = surface.getCanvas();
  c.scale(scale, scale);
  const paint = (hex: string, a = 1) => {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    p.setColor(Skia.Color(hex));
    p.setAlphaf(a);
    return p;
  };
  const d = fromKey(page.date);
  const r = rng(Number(page.date.replace(/-/g, '')));

  // papier : fond, fibres, léger bord plus sombre côté reliure
  c.drawRect(Skia.XYWHRect(0, 0, w, h), paint(PAPER));
  const fib = paint('#8C8A6E', 0.05);
  fib.setStyle(1);
  fib.setStrokeWidth(0.6);
  for (let i = 0; i < 120; i++) {
    const x = r() * w;
    const y = r() * h;
    const p = Skia.PathBuilder.Make();
    p.moveTo(x, y);
    p.quadTo(x + (r() - 0.5) * 24, y + (r() - 0.5) * 24, x + (r() - 0.5) * 34, y + (r() - 0.5) * 34);
    c.drawPath(p.build(), fib);
  }
  for (let i = 0; i < 18; i++) c.drawRect(Skia.XYWHRect(i * 1.2, 0, 1.2, h), paint('#5A5A40', 0.035 * (1 - i / 18)));

  const M = 26; // marge
  // en-tête : jour en kanji, date, année
  text(fonts, `${KANJI_DAY[d.getDay()]}曜日`, 'Mincho', 13, '#6F8A63', w).paint(c, M, 26);
  text(fonts, `${d.getDate()} ${MONTHS[d.getMonth()]}`, 'Mincho', 30, INK, w - M * 2 - 70, TextAlign.Left, 1.1).paint(c, M, 44);
  text(fonts, `${capitalize(DAYS_LONG[d.getDay()])} · ${d.getFullYear()}`, 'Gothic', 12, MUTED, w).paint(c, M, 84);

  // cachet (hanko) de l'humeur, un peu de travers
  const mood = moodOf(page.entry?.mood);
  const hx = w - M - 30;
  const hy = 58;
  c.save();
  c.rotate(-8 + r() * 6, hx, hy);
  const ring = paint(mood ? HANKO : RULE, mood ? 0.9 : 0.9);
  ring.setStyle(1);
  ring.setStrokeWidth(2.2);
  c.drawCircle(hx, hy, 27, ring);
  if (mood) {
    c.drawCircle(hx, hy, 23, paint(HANKO, 0.08));
    const k = text(fonts, mood.kanji, 'Mincho', 28, HANKO, 60, TextAlign.Center, 1);
    k.paint(c, hx - 30, hy - 18);
  }
  c.restore();

  // lignes du cahier
  const top = 118;
  const LH = 30;
  const rule = paint(RULE, 0.9);
  rule.setStyle(1);
  rule.setStrokeWidth(0.8);
  for (let y = top + LH; y < h - 70; y += LH) {
    const p = Skia.PathBuilder.Make();
    p.moveTo(M, y);
    p.lineTo(w - M, y);
    c.drawPath(p.build(), rule);
  }

  // le texte du jour, posé sur les lignes
  const body = page.entry?.text?.trim();
  const isToday = page.date === todayKey();
  const para = text(
    fonts,
    body || (isToday ? tr('Page blanche. Écris une ligne pour aujourd’hui, en dessous du livre.') : tr('Rien d’écrit ce jour-là.')),
    'Mincho',
    17,
    body ? INK : MUTED,
    w - M * 2,
    TextAlign.Left,
    LH / 17,
  );
  para.paint(c, M, top + 4);

  // fleur séchée de la saison, dans le coin
  const season = seasonOf(currentMicroSeason(d, hemisphere).index);
  const fx = M + 26;
  const fy = h - 88;
  c.save();
  c.rotate(-20 + r() * 40, fx, fy);
  if (season === 'printemps') {
    for (let k = 0; k < 5; k++) {
      c.save();
      c.rotate(k * 72, fx, fy);
      c.drawOval(Skia.XYWHRect(fx - 6, fy - 22, 12, 18), paint('#E8A7B6', 0.55));
      c.restore();
    }
    c.drawCircle(fx, fy, 3, paint('#C98A4A', 0.6));
  } else if (season === 'automne') {
    const p = Skia.PathBuilder.Make();
    for (let k = 0; k < 10; k++) {
      const a = (k * Math.PI) / 5 - Math.PI / 2;
      const rr = k % 2 ? 9 : 22;
      if (k === 0) p.moveTo(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr);
      else p.lineTo(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr);
    }
    p.close();
    c.drawPath(p.build(), paint('#C9622F', 0.45));
  } else if (season === 'hiver') {
    const p = paint('#8FA6B0', 0.5);
    p.setStyle(1);
    p.setStrokeWidth(1.4);
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      const b = Skia.PathBuilder.Make();
      b.moveTo(fx, fy);
      b.lineTo(fx + Math.cos(a) * 18, fy + Math.sin(a) * 18);
      c.drawPath(b.build(), p);
    }
  } else {
    // été : une feuille de bambou
    const p = Skia.PathBuilder.Make();
    p.moveTo(fx - 26, fy + 6);
    p.quadTo(fx, fy - 12, fx + 26, fy - 6);
    p.quadTo(fx, fy + 4, fx - 26, fy + 6);
    p.close();
    c.drawPath(p.build(), paint('#7FA06A', 0.45));
  }
  c.restore();

  // pied de page : bilan du jour et numéro
  const bits = [
    page.tasks ? trn(page.tasks, '{n} tâche', '{n} tâches') : '',
    page.focus ? tr('{n} min de focus', { n: page.focus }) : '',
    page.rituals ? trn(page.rituals, '{n} rituel', '{n} rituels') : '',
  ].filter(Boolean);
  if (bits.length) text(fonts, bits.join('  ·  '), 'Gothic', 11.5, MUTED, w - M * 2 - 60, TextAlign.Right).paint(c, M + 60, h - 56);
  text(fonts, `— ${page.number} —`, 'Mincho', 12, MUTED, w, TextAlign.Center).paint(c, 0, h - 32);

  surface.flush();
  const img = surface.makeImageSnapshot();
  // image « CPU » : utilisable ensuite sur le fil d'affichage, dans le shader de pli
  return img.makeNonTextureImage() ?? img;
}
