import type { DB } from '../../data/types';
import { gardenOf } from '../garden';

// 盆栽 — un arbre unique, généré une fois (graine fixe), qui pousse avec l'année :
// chaque jour actif fait apparaître un rameau ; les extrémités portent des « nuages »
// de feuillage (les pads du bonsaï), chacun relié à un jour.

export interface Node {
  parent: number; // -1 = tronc
  ang: number; // direction absolue (radians, 0 = droite, -π/2 = haut)
  len: number; // longueur relative (1 = hauteur de référence)
  w: number; // épaisseur à la base, relative
  depth: number;
  bend: number; // courbure du segment
  sway: number; // phase propre au vent
}

export interface Pad {
  node: number;
  date: string;
  size: number; // 0.7 – 1.5
  bloom: boolean; // belle journée : fleurs / couleurs vives
}

export interface Bonsai {
  nodes: Node[];
  visible: number;
  pads: Pad[];
  active: number;
  bloomDays: number;
}

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Arbre complet, dans l'ordre de pousse (le tronc d'abord, puis les branches par niveau). */
export function buildTree(seed = 20261): Node[] {
  const r = rng(seed);
  const nodes: Node[] = [];
  // tronc « moyogi » : sinueux, en 4 segments
  let ang = -Math.PI / 2 + 0.25;
  for (let i = 0; i < 4; i++) {
    ang += (i % 2 ? -1 : 1) * (0.32 + r() * 0.12);
    nodes.push({ parent: i - 1, ang, len: 0.15 - i * 0.012, w: 0.085 - i * 0.014, depth: 0, bend: (i % 2 ? 1 : -1) * 0.18, sway: r() * 6.28 });
  }
  // branches principales, alternées gauche / droite, presque horizontales
  const queue: number[] = [];
  for (let i = 1; i < 4; i++) {
    for (const side of i === 3 ? [-1, 1] : [i % 2 ? -1 : 1]) {
      const a = side < 0 ? Math.PI + 0.25 - r() * 0.35 : -0.25 + r() * 0.35;
      nodes.push({ parent: i, ang: a, len: 0.17 - i * 0.02 + r() * 0.04, w: nodes[i].w * 0.62, depth: 1, bend: 0.25 * side, sway: r() * 6.28 });
      queue.push(nodes.length - 1);
    }
  }
  // apex
  nodes.push({ parent: 3, ang: -Math.PI / 2 - 0.1, len: 0.08, w: 0.03, depth: 1, bend: 0.1, sway: r() * 6.28 });
  queue.push(nodes.length - 1);
  // ramifications
  while (queue.length && nodes.length < 140) {
    const p = queue.shift()!;
    const n = nodes[p];
    if (n.depth >= 4) continue;
    const kids = n.depth < 2 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const spread = (k - (kids - 1) / 2) * (0.55 + r() * 0.3);
      // les rameaux restent à plat, légèrement relevés (silhouette en nuages)
      const lift = Math.cos(n.ang) > 0 ? -0.18 : 0.18;
      nodes.push({ parent: p, ang: n.ang + spread + lift * 0.5, len: n.len * (0.58 + r() * 0.18), w: n.w * 0.62, depth: n.depth + 1, bend: (r() - 0.5) * 0.4, sway: r() * 6.28 });
      queue.push(nodes.length - 1);
    }
  }
  return nodes;
}

export const TREE = buildTree();

/** Positions de repos (sans vent). */
export function restPositions(nodes: Node[], visible: number, scale: number, ox: number, oy: number): number[] {
  const pos: number[] = [];
  for (let i = 0; i < visible; i++) {
    const n = nodes[i];
    const px = n.parent < 0 ? ox : pos[n.parent * 2];
    const py = n.parent < 0 ? oy : pos[n.parent * 2 + 1];
    pos.push(px + Math.cos(n.ang) * n.len * scale, py + Math.sin(n.ang) * n.len * scale);
  }
  return pos;
}

/** Cadrage : l'arbre ENTIER (fin d'année) tient dans le cadre, le pied du tronc au-dessus du pot. */
export function fitTree(nodes: Node[], w: number, h: number): { scale: number; ox: number; oy: number } {
  const p = restPositions(nodes, nodes.length, 1, 0, 0);
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  for (let i = 0; i < p.length; i += 2) {
    minX = Math.min(minX, p[i]);
    maxX = Math.max(maxX, p[i]);
    minY = Math.min(minY, p[i + 1]);
  }
  const padR = 0.09; // place pour les nuages de feuillage
  const scale = Math.min((w * 0.9) / (maxX - minX + padR * 2), (h * 0.6) / (-minY + padR));
  const oy = h * 0.7;
  const ox = w / 2 - ((minX + maxX) / 2) * scale;
  return { scale, ox, oy };
}

export function bonsaiOf(db: DB, year: number, until: string): Bonsai {
  const g = gardenOf(db, year);
  const days = [...g.entries()].filter(([k, d]) => k <= until && d.score > 0).sort((a, b) => a[0].localeCompare(b[0]));
  // l'arbre a déjà sa charpente et quelques rameaux au départ, puis s'étoffe jour après jour
  const visible = Math.min(TREE.length, 22 + Math.round(days.length * 1.3));
  // feuillage aux extrémités visibles (nœuds sans enfant visible), et le long des branches fines
  const hasChild = new Set<number>();
  for (let i = 0; i < visible; i++) if (TREE[i].parent >= 0) hasChild.add(TREE[i].parent);
  const tips: number[] = [];
  for (let i = 4; i < visible; i++) if (!hasChild.has(i) || TREE[i].depth >= 3) tips.push(i);
  const pads: Pad[] = tips.map((node, k) => {
    const day = days.length ? days[Math.min(days.length - 1, Math.floor((k / Math.max(1, tips.length)) * days.length))] : null;
    const score = day ? day[1].score : 0;
    return { node, date: day ? day[0] : '', size: 0.75 + Math.min(0.7, score * 0.09), bloom: score >= 4 };
  });
  return { nodes: TREE, visible, pads, active: days.length, bloomDays: days.filter(([, d]) => d.score >= 4).length };
}
