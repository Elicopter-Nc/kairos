// Décors SVG des widgets (rendus en image par AndroidSVG) : la même ambiance
// « komorebi » que l'app, mais immobile. Ombres de feuillage, taches de lumière,
// particules de la saison, ciel de la météo, papier des notes.
// Tout est déterministe (graine = jour + widget) : le décor change chaque jour
// sans clignoter à chaque mise à jour.

import type { Swatch } from '../data/types';
import { currentMicroSeason } from '../lib/seasons';
import type { Sky } from '../lib/weather';
import { SWATCHES } from '../theme';
import { DARK, Pal, Size } from './palette';

export type Particle = 'petale' | 'pollen' | 'luciole' | 'erable' | 'neige';

/** Petites particules de la saison, comme dans le shader de l'app. */
export function seasonParticle(hemisphere: 'nord' | 'sud', date = new Date()): Particle {
  const i = currentMicroSeason(date, hemisphere).index;
  const h = date.getHours();
  if (i >= 6 && i <= 20) return 'petale';
  if (i >= 21 && i <= 44) return h >= 19 || h < 6 ? 'luciole' : 'pollen';
  if (i >= 45 && i <= 62) return 'erable';
  return 'neige';
}

export function swatchOf(c: Swatch, p: Pal): `#${string}` {
  return (p === DARK ? SWATCHES[c].nuit : SWATCHES[c].jour) as `#${string}`;
}

// ── petits outils ──
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const f = (n: number) => n.toFixed(1);
const dayKey = () => new Date().toDateString();
const dark = (p: Pal) => p === DARK;

function svg(w: number, h: number, defs: string, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(w)}" height="${f(h)}" viewBox="0 0 ${f(w)} ${f(h)}"><defs>${defs}</defs>${body}</svg>`;
}

/** Fond : dégradé doux, bord fin, coins arrondis. */
function base(w: number, h: number, p: Pal, r: number, tint?: string) {
  const top = tint ?? (dark(p) ? '#1F251C' : '#F4F5EC');
  const defs = `<linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${p.bg}"/></linearGradient>`;
  const body = `<rect x="0.5" y="0.5" width="${f(w - 1)}" height="${f(h - 1)}" rx="${r}" fill="url(#bg)" stroke="${p.line}" stroke-opacity="0.9" stroke-width="1"/>`;
  return { defs, body };
}

/** Taches de lumière qui passent entre les feuilles. */
function lightSpots(w: number, h: number, p: Pal, rand: () => number, n = 3) {
  const c = dark(p) ? '#9DB58F' : '#FFFBEA';
  const o = dark(p) ? 0.13 : 0.85;
  let defs = `<radialGradient id="spot"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
  let body = '';
  for (let i = 0; i < n; i++) {
    const rx = 40 + rand() * Math.min(w, 220) * 0.45;
    body += `<ellipse cx="${f(w * (0.35 + rand() * 0.65))}" cy="${f(h * rand() * 0.7)}" rx="${f(rx)}" ry="${f(rx * (0.55 + rand() * 0.3))}" fill="url(#spot)"/>`;
  }
  return { defs, body };
}

const LEAF = (l: number) =>
  `M0,${f(-l)} C${f(l * 0.5)},${f(-l * 0.55)} ${f(l * 0.42)},${f(l * 0.5)} 0,${f(l)} C${f(-l * 0.42)},${f(l * 0.5)} ${f(-l * 0.5)},${f(-l * 0.55)} 0,${f(-l)} Z`;

/** Ombre d'une branche feuillue qui entre par le coin haut droit. */
function leafShadow(w: number, h: number, p: Pal, rand: () => number, scale = 1) {
  const fill = dark(p) ? '#060805' : '#7E9070';
  const o = dark(p) ? 0.42 : 0.16;
  const ox = w + 6;
  const oy = -10;
  const len = Math.min(w * 0.55, 190) * scale;
  const ang = 2.35 + (rand() - 0.5) * 0.35; // la branche descend vers la gauche
  let body = `<g fill="${fill}" fill-opacity="${o}" stroke="${fill}" stroke-opacity="${o}">`;
  body += `<path d="M${f(ox)},${f(oy)} Q${f(ox + Math.cos(ang) * len * 0.5 + 10)},${f(oy + Math.sin(ang) * len * 0.5 + 12)} ${f(ox + Math.cos(ang) * len)},${f(oy + Math.sin(ang) * len)}" fill="none" stroke-width="1.6"/>`;
  const n = 7;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 0.4);
    const bx = ox + Math.cos(ang) * len * t;
    const by = oy + Math.sin(ang) * len * t;
    const side = i % 2 ? 1 : -1;
    const rot = (ang * 180) / Math.PI - 90 + side * (38 + rand() * 22);
    const l = (11 + rand() * 7) * scale * (1.1 - t * 0.35);
    body += `<path transform="translate(${f(bx)},${f(by)}) rotate(${f(rot)}) translate(0,${f(l)})" d="${LEAF(l)}" stroke="none"/>`;
  }
  body += `<path transform="translate(${f(ox + Math.cos(ang) * len)},${f(oy + Math.sin(ang) * len)}) rotate(${f((ang * 180) / Math.PI - 90)}) translate(0,10)" d="${LEAF(10 * scale)}" stroke="none"/>`;
  body += '</g>';
  return { defs: '', body };
}

/** Quelques particules de saison éparpillées (moins nombreuses que dans l'app). */
function particles(w: number, h: number, p: Pal, kind: Particle, rand: () => number, n = 7) {
  let defs = '';
  let body = '';
  const area = (w * h) / 9000;
  const count = Math.max(3, Math.min(n, Math.round(area * 1.6)));
  if (kind === 'luciole' || kind === 'pollen') {
    const c = kind === 'luciole' ? '#E8F59B' : dark(p) ? '#C9D3A8' : '#E9D98A';
    defs = `<radialGradient id="glow"><stop offset="0" stop-color="${c}" stop-opacity="0.9"/><stop offset="0.25" stop-color="${c}" stop-opacity="0.5"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
    for (let i = 0; i < count; i++) {
      const r = (kind === 'luciole' ? 7 : 4) + rand() * 4;
      body += `<circle cx="${f(rand() * w)}" cy="${f(rand() * h)}" r="${f(r)}" fill="url(#glow)"/>`;
    }
    return { defs, body };
  }
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const rot = rand() * 360;
    if (kind === 'petale') {
      const s = 3.2 + rand() * 2.2;
      body += `<path transform="translate(${f(x)},${f(y)}) rotate(${f(rot)})" d="M0,${f(-s * 1.4)} C${f(s)},${f(-s)} ${f(s * 0.8)},${f(s)} 0,${f(s * 1.4)} C${f(-s * 0.8)},${f(s)} ${f(-s)},${f(-s)} 0,${f(-s * 1.4)} Z" fill="${dark(p) ? '#A87D86' : '#EDB5C1'}" fill-opacity="${dark(p) ? 0.75 : 0.9}"/>`;
    } else if (kind === 'erable') {
      const s = 4 + rand() * 2.5;
      let d = '';
      for (let k = 0; k < 10; k++) {
        const a = (k * Math.PI) / 5 - Math.PI / 2;
        const r = k % 2 ? s * 0.45 : s;
        d += `${k ? 'L' : 'M'}${f(Math.cos(a) * r)},${f(Math.sin(a) * r)} `;
      }
      body += `<path transform="translate(${f(x)},${f(y)}) rotate(${f(rot)})" d="${d}Z" fill="${dark(p) ? '#A3573A' : '#D9824A'}" fill-opacity="0.8"/>`;
    } else {
      body += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.3 + rand() * 1.6)}" fill="${dark(p) ? '#C9CFC4' : '#FFFFFF'}" fill-opacity="${dark(p) ? 0.55 : 0.95}"/>`;
    }
  }
  return { defs, body };
}

export interface ArtOptions {
  name: string; // graine
  particle?: Particle | null;
  leaves?: boolean;
  radius?: number;
  extra?: { defs: string; body: string };
  tint?: string;
}

/** Fond komorebi complet d'un widget. */
export function komorebi(size: Size, p: Pal, o: ArtOptions): string {
  const { width: w, height: h } = size;
  const rand = rng(o.name + dayKey());
  const r = o.radius ?? 22;
  const parts = [base(w, h, p, r, o.tint), lightSpots(w, h, p, rand, h < 100 ? 2 : 3)];
  if (o.leaves !== false) parts.push(leafShadow(w, h, p, rand, h < 100 ? 0.6 : 1));
  if (o.extra) parts.push(o.extra);
  if (o.particle) parts.push(particles(w, h, p, o.particle, rand));
  // tout est découpé à la forme du widget
  const defs = parts.map((x) => x.defs).join('') + `<clipPath id="clip"><rect width="${f(w)}" height="${f(h)}" rx="${r}"/></clipPath>`;
  const [first, ...rest] = parts;
  return svg(w, h, defs, first.body + `<g clip-path="url(#clip)">${rest.map((x) => x.body).join('')}</g>`);
}

// ── ciel de la météo ──
export function skyArt(w: number, h: number, p: Pal, sky: Sky, isDay: boolean): { defs: string; body: string } {
  const d = dark(p);
  let defs = '';
  let body = '';
  // astre dans le coin haut droit, à moitié sorti du cadre : il ne gêne pas le texte
  const sunX = w - 16;
  const sunY = 8;
  if (sky === 'clair' && isDay) {
    defs += `<radialGradient id="sun"><stop offset="0" stop-color="#F6DC8A" stop-opacity="${d ? 0.55 : 0.95}"/><stop offset="0.22" stop-color="#F2D27A" stop-opacity="${d ? 0.3 : 0.6}"/><stop offset="1" stop-color="#F2D27A" stop-opacity="0"/></radialGradient>`;
    body += `<circle cx="${f(sunX)}" cy="${f(sunY)}" r="${f(Math.min(130, w * 0.42))}" fill="url(#sun)"/>`;
    body += `<circle cx="${f(sunX)}" cy="${f(sunY)}" r="13" fill="#F3D67E" fill-opacity="${d ? 0.85 : 1}"/>`;
  } else if (sky === 'clair') {
    defs += `<radialGradient id="moon"><stop offset="0" stop-color="#DDE6F0" stop-opacity="0.35"/><stop offset="1" stop-color="#DDE6F0" stop-opacity="0"/></radialGradient>`;
    body += `<circle cx="${f(sunX)}" cy="${f(sunY)}" r="70" fill="url(#moon)"/>`;
    body += `<circle cx="${f(sunX)}" cy="${f(sunY)}" r="12" fill="#E9EEDF"/><circle cx="${f(sunX + 6)}" cy="${f(sunY - 4)}" r="10.5" fill="${p.bg}"/>`;
    const rand = rng('etoiles' + dayKey());
    for (let i = 0; i < 9; i++) body += `<circle cx="${f(rand() * w)}" cy="${f(rand() * h * 0.6)}" r="${f(0.6 + rand() * 0.9)}" fill="#E9EEDF" fill-opacity="${f(0.4 + rand() * 0.5)}"/>`;
  }
  const cloud = (cx: number, cy: number, s: number, op: number) => {
    const c = d ? '#C9D3C0' : '#FFFFFF';
    return `<g fill="${c}" fill-opacity="${op}"><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(34 * s)}" ry="${f(13 * s)}"/><circle cx="${f(cx - 10 * s)}" cy="${f(cy - 8 * s)}" r="${f(13 * s)}"/><circle cx="${f(cx + 9 * s)}" cy="${f(cy - 11 * s)}" r="${f(17 * s)}"/></g>`;
  };
  if (sky === 'voile') body += cloud(sunX - 40, sunY + 22, 1, d ? 0.1 : 0.75);
  if (sky === 'couvert' || sky === 'pluie' || sky === 'bruine' || sky === 'orage' || sky === 'neige' || sky === 'brouillard') {
    body += cloud(sunX - 70, sunY + 14, 1.25, d ? 0.08 : 0.6) + cloud(sunX - 10, sunY + 28, 0.9, d ? 0.1 : 0.7);
  }
  if (sky === 'pluie' || sky === 'bruine' || sky === 'orage') {
    const rand = rng('pluie' + dayKey());
    const n = sky === 'bruine' ? 14 : 26;
    let lines = '';
    for (let i = 0; i < n; i++) {
      const x = rand() * (w + 30);
      const y = rand() * h;
      const l = 7 + rand() * 9;
      lines += `M${f(x)},${f(y)} l${f(-l * 0.28)},${f(l)} `;
    }
    body += `<path d="${lines}" stroke="${d ? '#8FA3AD' : '#7F97A3'}" stroke-opacity="${d ? 0.45 : 0.4}" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
  }
  if (sky === 'orage') body += `<path d="M${f(sunX - 40)},${f(sunY + 34)} l-8,14 h7 l-6,13 l14,-18 h-7 l6,-9 z" fill="#F3D67E" fill-opacity="0.85"/>`;
  if (sky === 'brouillard') {
    for (let i = 0; i < 4; i++) body += `<rect x="${f(-20 + i * 14)}" y="${f(h * (0.25 + i * 0.17))}" width="${f(w * 0.9)}" height="7" rx="3.5" fill="${d ? '#C9D3C0' : '#FFFFFF'}" fill-opacity="${d ? 0.07 : 0.5}"/>`;
  }
  return { defs, body };
}

/** Teinte du haut du fond selon le ciel. */
export function skyTint(p: Pal, sky: Sky, isDay: boolean): string {
  const d = dark(p);
  if (sky === 'clair' && isDay) return d ? '#262A1C' : '#F7F1DA';
  if (sky === 'clair') return d ? '#161B22' : '#E4E8EE';
  if (sky === 'pluie' || sky === 'bruine' || sky === 'orage') return d ? '#1A2124' : '#E3E9EA';
  if (sky === 'neige') return d ? '#20251F' : '#F6F8F4';
  return d ? '#1F241D' : '#EEF0E8';
}

/** Courbe des températures (et barres de pluie) alignée sur des colonnes égales. */
export function tempCurve(w: number, h: number, temps: number[], rain: number[], p: Pal): string {
  const n = temps.length;
  const col = w / n;
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const span = Math.max(1, hi - lo);
  const pad = 6;
  const pts = temps.map((t, i) => [col * (i + 0.5), pad + (1 - (t - lo) / span) * (h - pad * 2 - 6)] as const);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 1; i < n; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${f(cx)},${f(y0)} ${f(cx)},${f(y1)} ${f(x1)},${f(y1)}`;
  }
  const area = `${d} L${f(pts[n - 1][0])},${f(h)} L${f(pts[0][0])},${f(h)} Z`;
  const defs = `<linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.check}" stop-opacity="${dark(p) ? 0.32 : 0.28}"/><stop offset="1" stop-color="${p.check}" stop-opacity="0"/></linearGradient>`;
  let body = `<path d="${area}" fill="url(#area)"/>`;
  rain.forEach((r, i) => {
    if (r < 15) return;
    const bh = Math.max(2, (r / 100) * (h * 0.45));
    body += `<rect x="${f(col * (i + 0.5) - 2.5)}" y="${f(h - bh)}" width="5" height="${f(bh)}" rx="2.5" fill="${dark(p) ? '#8FA3AD' : '#7F97A3'}" fill-opacity="${r >= 50 ? 0.85 : 0.45}"/>`;
  });
  body += `<path d="${d}" fill="none" stroke="${p.check}" stroke-width="2" stroke-linecap="round"/>`;
  pts.forEach(([x, y], i) => {
    body += `<circle cx="${f(x)}" cy="${f(y)}" r="${i === 0 ? 3.6 : 2.4}" fill="${i === 0 ? p.check : p.bg}" stroke="${p.check}" stroke-width="1.6"/>`;
  });
  return svg(w, h, defs, body);
}

/** Trait de pinceau de progression (effilé aux deux bouts). */
export function brushBar(w: number, h: number, frac: number, p: Pal): string {
  const stroke = (len: number, col: string, op: number) => {
    if (len < 2) return '';
    const m = h / 2;
    return `<path d="M0,${f(m)} Q${f(len * 0.08)},${f(m - h * 0.5)} ${f(len * 0.5)},${f(m - h * 0.42)} T${f(len)},${f(m - h * 0.1)} L${f(len)},${f(m + h * 0.12)} Q${f(len * 0.6)},${f(m + h * 0.5)} ${f(len * 0.25)},${f(m + h * 0.4)} T0,${f(m)} Z" fill="${col}" fill-opacity="${op}"/>`;
  };
  return svg(w, h, '', stroke(w, p.line, 1) + stroke(Math.max(0, Math.min(1, frac)) * w, p.check, 0.95));
}

/** Papier des notes : lignes réglées et ruban washi. */
export function paperArt(w: number, h: number, p: Pal, tape: string, top = 64): { defs: string; body: string } {
  const d = dark(p);
  let body = '';
  for (let y = top; y < h - 10; y += 24) body += `<line x1="16" y1="${f(y)}" x2="${f(w - 16)}" y2="${f(y)}" stroke="${p.line}" stroke-opacity="${d ? 0.55 : 0.8}" stroke-width="0.8"/>`;
  const tw = Math.min(78, w * 0.32);
  body += `<g transform="translate(${f(w / 2)},5) rotate(-3)"><rect x="${f(-tw / 2)}" y="-8" width="${f(tw)}" height="17" fill="${tape}" fill-opacity="${d ? 0.7 : 0.75}"/>`;
  for (let i = 0; i < 6; i++) body += `<line x1="${f(-tw / 2 + 6 + i * (tw / 6))}" y1="-8" x2="${f(-tw / 2 + 2 + i * (tw / 6))}" y2="9" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="3"/>`;
  body += '</g>';
  return { defs: '', body };
}

/** Fond « épuré » : un dégradé à peine visible et une seule lumière douce. */
export function epure(size: Size, p: Pal, name: string): string {
  const { width: w, height: h } = size;
  const r = 22;
  const rand = rng(name + dayKey());
  const b = base(w, h, p, r);
  const c = dark(p) ? '#9DB58F' : '#FFFFFF';
  const o = dark(p) ? 0.07 : 0.6;
  const defs = b.defs + `<radialGradient id="soft"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient><clipPath id="clip"><rect width="${f(w)}" height="${f(h)}" rx="${r}"/></clipPath>`;
  const rx = Math.max(w, h) * 0.7;
  const spot = `<ellipse cx="${f(w * (0.15 + rand() * 0.2))}" cy="${f(-h * 0.1)}" rx="${f(rx)}" ry="${f(rx * 0.6)}" fill="url(#soft)"/>`;
  return svg(w, h, defs, b.body + `<g clip-path="url(#clip)">${spot}</g>`);
}
