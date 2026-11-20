// Dessin du bonsaï, image par image (worklets). On leur passe une API Skia minimale,
// ce qui permet aussi de les tester hors du téléphone (CanvasKit).
import type { SkCanvas, SkPaint, SkPathBuilder } from '@shopify/react-native-skia';
import type { Node, Pad } from './tree';

export interface SkApi {
  paint: (hex: string, alpha?: number) => SkPaint;
  path: () => SkPathBuilder;
  blur: (p: SkPaint, sigma: number) => void;
  stroke: (p: SkPaint, width: number) => void;
  oval: (canvas: SkCanvas, cx: number, cy: number, rx: number, ry: number, p: SkPaint) => void;
  vgrad: (y0: number, y1: number, top: string, bottom: string) => SkPaint;
}

export type Season = 'printemps' | 'ete' | 'automne' | 'hiver';

export interface Scene {
  w: number;
  h: number;
  t: number;
  dark: boolean;
  season: Season;
  shake: number; // 0..1, coup de vent au toucher
  selected: number; // nœud du pad choisi, -1 = aucun
  falling: boolean; // pétales / feuilles qui tombent (jour actif)
  scale: number; // cadrage (voir fitTree)
  ox: number;
  oy: number;
  backdrop: boolean; // le fond komorebi est déjà dessiné dessous
}

const FOLIAGE: Record<Season, { base: string; hi: string; lo: string; dot: string }> = {
  printemps: { base: '#E7B3C0', hi: '#F8DDE4', lo: '#BE8394', dot: '#FFFFFF' },
  ete: { base: '#5E8A4D', hi: '#8FB872', lo: '#3B5F34', dot: '#B5D398' },
  automne: { base: '#C8622E', hi: '#E59A58', lo: '#8A3B1F', dot: '#F2C46D' },
  hiver: { base: '#56704F', hi: '#7D9670', lo: '#344A32', dot: '#FFFFFF' },
};

/** Positions des nœuds avec le vent (balancement plus fort aux extrémités). */
export function windPositions(nodes: Node[], visible: number, sc: Scene): number[] {
  'worklet';
  const scale = sc.scale;
  const pos: number[] = [];
  const acc: number[] = [];
  for (let i = 0; i < visible; i++) {
    const n = nodes[i];
    const gust = Math.sin(sc.t * 0.7 + n.sway) * 0.012 + Math.sin(sc.t * 0.23) * 0.01 + Math.sin(sc.t * 6 + n.sway) * 0.05 * sc.shake;
    const a = (n.parent < 0 ? 0 : acc[n.parent]) + gust * n.depth;
    acc.push(a);
    const px = n.parent < 0 ? sc.ox : pos[n.parent * 2];
    const py = n.parent < 0 ? sc.oy : pos[n.parent * 2 + 1];
    pos.push(px + Math.cos(n.ang + a) * n.len * scale, py + Math.sin(n.ang + a) * n.len * scale);
  }
  return pos;
}

/** Montagnes lointaines au lavis d'encre : trois couches, de plus en plus claires vers le fond. */
function mountains(canvas: SkCanvas, S: SkApi, sc: Scene) {
  'worklet';
  const { w, h, dark } = sc;
  const tint = sc.season === 'automne' ? (dark ? '#4A3A2C' : '#9C8A6E') : sc.season === 'hiver' ? (dark ? '#3C4448' : '#A9B4B8') : dark ? '#33402F' : '#8FA187';
  const layers: [number, number, number, number][] = [
    // hauteur de base, amplitude, fréquence, opacité
    [0.5, 0.13, 2.1, dark ? 0.35 : 0.22],
    [0.6, 0.1, 3.3, dark ? 0.45 : 0.3],
    [0.7, 0.07, 4.7, dark ? 0.55 : 0.38],
  ];
  for (let l = 0; l < layers.length; l++) {
    const [base, amp, freq, alpha] = layers[l];
    const b = S.path();
    b.moveTo(0, h);
    for (let i = 0; i <= 48; i++) {
      const x = (i / 48) * w;
      const u = i / 48;
      const y = h * (base - amp * (0.55 * Math.sin(u * freq * 3.1 + l * 1.7) + 0.3 * Math.sin(u * freq * 7.3 + l) + 0.15 * Math.sin(u * freq * 13.1 + l * 2.3)));
      b.lineTo(x, y);
    }
    b.lineTo(w, h);
    b.close();
    const p = S.paint(tint, alpha);
    S.blur(p, l === 0 ? 3 : 1.2);
    canvas.drawPath(b.build(), p);
  }
  // brume au pied des montagnes
  const mist = S.paint(dark ? '#1C2219' : '#F4F2E6', dark ? 0.6 : 0.7);
  S.blur(mist, 18);
  S.oval(canvas, w * 0.5, h * 0.74, w * 0.75, h * 0.06, mist);
}

/** Table basse en bois sous la poterie. */
function table(canvas: SkCanvas, S: SkApi, sc: Scene, cx: number, top: number, pw: number) {
  'worklet';
  const { h, dark } = sc;
  const tw = Math.min(sc.w * 0.94, pw * 1.45);
  const th = 9;
  const sh = S.paint('#000000', dark ? 0.5 : 0.25);
  S.blur(sh, 10);
  S.oval(canvas, cx, top + th + 18, tw * 0.52, 7, sh);
  canvas.drawRect({ x: cx - tw / 2, y: top, width: tw, height: th }, S.vgrad(top, top + th, dark ? '#5C4433' : '#7A5A40', dark ? '#3E2E22' : '#5A4130'));
  canvas.drawRect({ x: cx - tw / 2, y: top, width: tw, height: 1.5 }, S.paint('#FFFFFF', dark ? 0.08 : 0.2));
  const vein = S.paint(dark ? '#2E2219' : '#4A3526', 0.35);
  S.stroke(vein, 0.8);
  for (let k = 0; k < 2; k++) {
    const b = S.path();
    b.moveTo(cx - tw / 2 + 10, top + 3 + k * 3);
    b.quadTo(cx, top + 2 + k * 3.4 + Math.sin(k) * 2, cx + tw / 2 - 10, top + 3 + k * 3);
    canvas.drawPath(b.build(), vein);
  }
  const leg = S.paint(dark ? '#33261C' : '#4A3526');
  const lh = Math.max(0, Math.min(h - top - th, 24));
  canvas.drawRect({ x: cx - tw / 2 + 12, y: top + th, width: 11, height: lh }, leg);
  canvas.drawRect({ x: cx + tw / 2 - 23, y: top + th, width: 11, height: lh }, leg);
}

function background(canvas: SkCanvas, S: SkApi, sc: Scene) {
  'worklet';
  const { w, h } = sc;
  if (!sc.backdrop) canvas.drawRect({ x: 0, y: 0, width: w, height: h }, S.vgrad(0, h, sc.dark ? '#20271F' : '#F3F1E4', sc.dark ? '#151A14' : '#E4E7D6'));
  // soleil pâle ou lune, derrière l'arbre
  const disc = S.paint(sc.dark ? '#E6EADB' : '#F2C9A0', sc.dark ? 0.1 : 0.4);
  canvas.drawCircle(w * 0.72, h * 0.24, Math.min(w, h) * 0.16, disc);
  mountains(canvas, S, sc);
}

function branch(canvas: SkCanvas, S: SkApi, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, bend: number, bark: SkPaint, hi: SkPaint) {
  'worklet';
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  const mx = (x0 + x1) / 2 + nx * L * bend;
  const my = (y0 + y1) / 2 + ny * L * bend;
  const p = S.path();
  p.moveTo(x0 + nx * w0, y0 + ny * w0);
  p.quadTo(mx + nx * (w0 + w1) * 0.5, my + ny * (w0 + w1) * 0.5, x1 + nx * w1, y1 + ny * w1);
  p.lineTo(x1 - nx * w1, y1 - ny * w1);
  p.quadTo(mx - nx * (w0 + w1) * 0.5, my - ny * (w0 + w1) * 0.5, x0 - nx * w0, y0 - ny * w0);
  p.close();
  canvas.drawPath(p.build(), bark);
  // reflet sur un côté de l'écorce
  if (w0 > 2) {
    const q = S.path();
    q.moveTo(x0 + nx * w0 * 0.5, y0 + ny * w0 * 0.5);
    q.quadTo(mx + nx * (w0 + w1) * 0.25, my + ny * (w0 + w1) * 0.25, x1 + nx * w1 * 0.5, y1 + ny * w1 * 0.5);
    S.stroke(hi, Math.max(1, w0 * 0.35));
    canvas.drawPath(q.build(), hi);
  }
  canvas.drawCircle(x1, y1, w1, bark); // jointure arrondie
}

/** Un « nuage » de feuillage : ombre, masse, lumière, petits points de feuilles. */
function pad(canvas: SkCanvas, S: SkApi, x: number, y: number, r: number, seed: number, sc: Scene, bloom: boolean, selected: boolean) {
  'worklet';
  const f = FOLIAGE[sc.season];
  const rnd = (n: number) => {
    'worklet';
    const v = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const count = 7;
  const sh = S.paint('#000000', sc.dark ? 0.35 : 0.18);
  S.blur(sh, r * 0.25);
  S.oval(canvas, x + r * 0.15, y + r * 0.35, r * 1.25, r * 0.55, sh);
  const lo = S.paint(f.lo);
  const base = S.paint(f.base);
  const hi = S.paint(f.hi, 0.9);
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + rnd(k);
    const cx = x + Math.cos(a) * r * 0.75;
    const cy = y + Math.sin(a) * r * 0.32;
    S.oval(canvas, cx, cy + r * 0.12, r * (0.48 + rnd(k + 9) * 0.2), r * (0.36 + rnd(k + 4) * 0.12), lo);
  }
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + rnd(k);
    const cx = x + Math.cos(a) * r * 0.7;
    const cy = y + Math.sin(a) * r * 0.28 - r * 0.06;
    S.oval(canvas, cx, cy, r * (0.44 + rnd(k + 9) * 0.2), r * (0.32 + rnd(k + 4) * 0.12), base);
  }
  // lumière venant d'en haut à gauche
  for (let k = 0; k < 4; k++) {
    const cx = x - r * 0.35 + rnd(k + 20) * r * 0.7;
    const cy = y - r * 0.18 - rnd(k + 30) * r * 0.12;
    S.oval(canvas, cx, cy, r * (0.26 + rnd(k + 40) * 0.12), r * 0.16, hi);
  }
  // petites feuilles / fleurs
  const dot = S.paint(bloom && sc.season !== 'hiver' ? (sc.season === 'ete' ? '#F4E3A0' : f.dot) : f.dot, bloom ? 0.95 : 0.35);
  const n = bloom ? 9 : 5;
  for (let k = 0; k < n; k++) canvas.drawCircle(x + (rnd(k + 50) - 0.5) * r * 1.6, y + (rnd(k + 60) - 0.6) * r * 0.6, r * (bloom ? 0.07 : 0.045), dot);
  // hiver : neige sur le dessus
  if (sc.season === 'hiver') {
    const snow = S.paint('#FFFFFF', 0.92);
    S.oval(canvas, x - r * 0.05, y - r * 0.28, r * 0.95, r * 0.16, snow);
  }
  if (selected) {
    const ring = S.paint(sc.dark ? '#E6EADB' : '#2E372D', 0.8);
    S.stroke(ring, 1.6);
    S.oval(canvas, x, y, r * 1.45 + Math.sin(sc.t * 3) * 1.5, r * 0.8 + Math.sin(sc.t * 3) * 1, ring);
  }
}

function pot(canvas: SkCanvas, S: SkApi, sc: Scene) {
  'worklet';
  const { w, h } = sc;
  const cx = Math.min(w * 0.62, Math.max(w * 0.38, sc.ox));
  const top = sc.oy;
  const pw = w * 0.56;
  const ph = h * 0.1;
  table(canvas, S, sc, cx, top + ph + 5, pw);
  // ombre de la poterie sur la table
  const sh = S.paint('#000000', sc.dark ? 0.45 : 0.22);
  S.blur(sh, 5);
  S.oval(canvas, cx, top + ph + 5, pw * 0.5, 4, sh);
  // corps émaillé (céladon sombre)
  const body = S.path();
  body.moveTo(cx - pw / 2, top + 6);
  body.lineTo(cx + pw / 2, top + 6);
  body.lineTo(cx + pw / 2 - pw * 0.06, top + ph);
  body.lineTo(cx - pw / 2 + pw * 0.06, top + ph);
  body.close();
  canvas.drawPath(body.build(), S.vgrad(top, top + ph, sc.dark ? '#4C6660' : '#5E7D76', sc.dark ? '#2C3D39' : '#3D5852'));
  // pieds
  const feet = S.paint(sc.dark ? '#27342F' : '#33473F');
  canvas.drawRect({ x: cx - pw / 2 + pw * 0.08, y: top + ph, width: pw * 0.1, height: 5 }, feet);
  canvas.drawRect({ x: cx + pw / 2 - pw * 0.18, y: top + ph, width: pw * 0.1, height: 5 }, feet);
  // lèvre et reflet
  canvas.drawRect({ x: cx - pw / 2 - 5, y: top, width: pw + 10, height: 7 }, S.paint(sc.dark ? '#5E7A73' : '#71928A'));
  canvas.drawRect({ x: cx - pw / 2 + 10, y: top + 12, width: pw * 0.5, height: 2 }, S.paint('#FFFFFF', 0.18));
  // mousse et petites pierres
  const moss = S.paint(sc.season === 'hiver' ? '#E8ECE6' : sc.dark ? '#4A6340' : '#6E8F55');
  S.oval(canvas, cx, top + 1, pw * 0.46, 7, moss);
  for (let k = 0; k < 9; k++) canvas.drawCircle(cx - pw * 0.4 + k * pw * 0.1, top - 1 + Math.sin(k * 2.3) * 2, 3 + Math.abs(Math.sin(k * 7.1)) * 3, S.paint(sc.season === 'hiver' ? '#FFFFFF' : '#86A86B', 0.7));
  S.oval(canvas, cx + pw * 0.28, top - 1, 7, 4, S.paint('#6D6E64'));
}

function falling(canvas: SkCanvas, S: SkApi, sc: Scene) {
  'worklet';
  if (!sc.falling) return;
  const f = FOLIAGE[sc.season];
  const col = sc.season === 'printemps' ? '#F2C4CE' : sc.season === 'automne' ? '#D9824A' : sc.season === 'hiver' ? '#FFFFFF' : f.hi;
  for (let i = 0; i < 7; i++) {
    const r1 = Math.sin(i * 91.7) * 0.5 + 0.5;
    const life = (sc.t * 0.08 + r1) % 1;
    const x = sc.w * (0.25 + 0.5 * Math.sin(i * 47.3) * 0.5 + 0.25) + Math.sin(sc.t * 1.3 + i) * 14 + life * 30;
    const y = sc.h * (0.2 + life * 0.6);
    canvas.save();
    canvas.rotate(sc.t * 60 + i * 50, x, y);
    S.oval(canvas, x, y, 4, 2.4, S.paint(col, 0.85 * (1 - life)));
    canvas.restore();
  }
}

/** Toute la scène. */
export function drawBonsai(canvas: SkCanvas, S: SkApi, nodes: Node[], visible: number, pads: Pad[], sc: Scene) {
  'worklet';
  background(canvas, S, sc);
  const pos = windPositions(nodes, visible, sc);
  const base = sc.scale;
  const bark = S.paint(sc.dark ? '#5A4838' : '#4E3D2F');
  const hi = S.paint(sc.dark ? '#8A7560' : '#7D6650', 0.55);
  // branches, du tronc vers les rameaux
  for (let i = 0; i < visible; i++) {
    const n = nodes[i];
    const x0 = n.parent < 0 ? sc.ox : pos[n.parent * 2];
    const y0 = n.parent < 0 ? sc.oy : pos[n.parent * 2 + 1];
    const w0 = n.w * base * 0.5;
    branch(canvas, S, x0, y0, pos[i * 2], pos[i * 2 + 1], w0, w0 * 0.72, n.bend, bark, hi);
  }
  // racines visibles au pied
  const rx = sc.ox;
  const ry = sc.oy;
  branch(canvas, S, rx - 2, ry - 6, rx - sc.w * 0.12, ry + 2, nodes[0].w * base * 0.3, 2, 0.1, bark, hi);
  branch(canvas, S, rx + 2, ry - 6, rx + sc.w * 0.1, ry + 2, nodes[0].w * base * 0.26, 2, -0.1, bark, hi);
  pot(canvas, S, sc);
  // feuillage : du plus bas au plus haut, pour que le haut recouvre le bas
  const order: number[] = [];
  for (let k = 0; k < pads.length; k++) order.push(k);
  order.sort((a, b) => pos[pads[b].node * 2 + 1] - pos[pads[a].node * 2 + 1]);
  for (let o = 0; o < order.length; o++) {
    const p = pads[order[o]];
    const r = sc.scale * 0.05 * p.size * (nodes[p.node].depth >= 3 ? 0.85 : 1.1);
    if (sc.season === 'hiver' && !p.bloom && o % 3 === 0) continue; // quelques branches nues l'hiver
    pad(canvas, S, pos[p.node * 2], pos[p.node * 2 + 1], r, p.node, sc, p.bloom, p.node === sc.selected);
  }
  falling(canvas, S, sc);
}
