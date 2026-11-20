// Palette et polices communes à tous les widgets Kairos (style Matcha).
export type Hex = `#${string}`;

export interface Pal {
  bg: Hex;
  ink: Hex;
  muted: Hex;
  line: Hex;
  accent: Hex; // kaki : retard / urgent
  check: Hex; // sauge
  chip: Hex;
  mark: `rgba(${number}, ${number}, ${number}, ${number})`; // kanji en filigrane
}

export const LIGHT: Pal = {
  bg: '#EEF0E5',
  ink: '#2E372D',
  muted: '#7C8875',
  line: '#D3D9C6',
  accent: '#B8613F',
  check: '#6F8A63',
  chip: '#F8F8F1',
  mark: 'rgba(111, 138, 99, 0.11)',
};

export const DARK: Pal = {
  bg: '#181C16',
  ink: '#E6EADB',
  muted: '#8E9A86',
  line: '#343C31',
  accent: '#E08A6C',
  check: '#9DB58F',
  chip: '#222820',
  mark: 'rgba(157, 181, 143, 0.08)',
};

export const BOLD = 'Gothic-Medium';
export const MEDIUM = 'Gothic-Regular';
export const SERIF = 'Mincho-Medium';

export function nowHM() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}

/** Taille réelle du widget sur l'écran d'accueil (en dp). */
export interface Size {
  width: number;
  height: number;
}

/**
 * Mise en page selon la taille choisie par l'utilisateur :
 * - « bande » : une seule rangée (hauteur d'une case, ex. 4×1 ou 2×1)
 * - « petit » : carré ou étroit (ex. 2×2)
 * - « grand » : la version complète
 */
export type Layout = 'bande' | 'petit' | 'grand';
export function layoutOf(s?: Size): Layout {
  if (!s || !s.width || !s.height) return 'grand';
  if (s.height < 100) return 'bande';
  if (s.width < 220) return 'petit';
  return 'grand';
}

/** Taille utilisable même si le lanceur n'a pas encore donné la vraie taille. */
export function sizeOr(s: Size | undefined, fallback: Size): Size {
  return s && s.width > 0 && s.height > 0 ? { width: Math.round(s.width), height: Math.round(s.height) } : fallback;
}

/** Variante de décor des widgets v2 / v3. */
export type Look = 'komorebi' | 'epure';
