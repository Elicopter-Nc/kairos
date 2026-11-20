import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { Swatch, ThemeMode } from './data/types';
import { currentMicroSeason, SeasonKind, seasonOf } from './lib/seasons';

// ─── Direction artistique « Matcha · Komorebi » ────────────────────────────
// Papier washi vert pâle, encre vert-de-gris, accent sauge, kaki pour l'urgence.
// Serif japonaise (Shippori Mincho) pour les titres et les chiffres,
// gothique douce (Zen Kaku Gothic) pour le texte. Filets fins, beaucoup d'air.
// En haut des écrans : la lumière qui filtre à travers les feuilles (komorebi).

// Couleurs « nippon » douces. Les clés restent celles des données enregistrées.
export const SWATCHES: Record<Swatch, { jour: string; nuit: string; label: string }> = {
  tomate: { jour: '#E8B49B', nuit: '#6E4535', label: 'Kaki' },
  soleil: { jour: '#EAD9A0', nuit: '#6A5E36', label: 'Yuzu' },
  citron: { jour: '#C9D6B0', nuit: '#4A5A3C', label: 'Matcha' },
  menthe: { jour: '#A9C4A6', nuit: '#3E5642', label: 'Sauge' },
  ciel: { jour: '#BCD0DC', nuit: '#3C5260', label: 'Ciel' },
  lilas: { jour: '#CBC3DD', nuit: '#4D4762', label: 'Glycine' },
  rose: { jour: '#EDC9C9', nuit: '#66474A', label: 'Sakura' },
  encre: { jour: '#3A4038', nuit: '#D9DECF', label: 'Sumi' },
};

export const SWATCH_ORDER: Swatch[] = ['citron', 'menthe', 'ciel', 'lilas', 'rose', 'tomate', 'soleil', 'encre'];

export interface Theme {
  dark: boolean;
  bg: string; // papier washi
  bgAlt: string; // papier un ton plus soutenu
  card: string; // feuille posée
  ink: string;
  inkSoft: string;
  muted: string;
  line: string; // filets
  accent: string; // sauge
  accentSoft: string; // matcha clair (tuiles, sélection)
  selection: string; // surlignage du texte sélectionné (translucide : le texte reste lisible)
  onAccent: string; // texte sur la sauge
  kaki: string; // urgent / en retard
  swatch: (s: Swatch) => string;
  onSwatch: (s: Swatch) => string;
  font: {
    mincho: string;
    minchoBold: string;
    regular: string;
    medium: string;
    bold: string;
  };
  // couleurs de base du shader komorebi (RVB 0-1)
  leaf: { paper: [number, number, number]; shade: [number, number, number] };
}

const font = {
  mincho: 'Mincho-Medium',
  minchoBold: 'Mincho-Bold',
  regular: 'Gothic-Regular',
  medium: 'Gothic-Medium',
  bold: 'Gothic-Bold',
};

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
];

export const jour: Theme = {
  dark: false,
  bg: '#EEF0E5',
  bgAlt: '#E4E8D9',
  card: '#F8F8F1',
  ink: '#2E372D',
  inkSoft: '#4A5547',
  muted: '#7C8875',
  line: '#D3D9C6',
  accent: '#6F8A63',
  accentSoft: '#C9D6B0',
  selection: 'rgba(111, 138, 99, 0.32)',
  onAccent: '#F8F8F1',
  kaki: '#B8613F',
  swatch: (s) => SWATCHES[s].jour,
  onSwatch: (s) => (s === 'encre' ? '#F4F5EE' : '#2E372D'),
  font,
  leaf: { paper: hex('#EEF0E5'), shade: hex('#A3B293') },
};

export const nuit: Theme = {
  dark: true,
  bg: '#181C16',
  bgAlt: '#1F241D',
  card: '#222820',
  ink: '#E6EADB',
  inkSoft: '#C9CFBD',
  muted: '#8E9A86',
  line: '#343C31',
  accent: '#9DB58F',
  accentSoft: '#3E4D36',
  selection: 'rgba(157, 181, 143, 0.35)',
  onAccent: '#181C16',
  kaki: '#E08A6C',
  swatch: (s) => SWATCHES[s].nuit,
  onSwatch: (s) => (s === 'encre' ? '#181C16' : '#EEF0E5'),
  font,
  leaf: { paper: hex('#181C16'), shade: hex('#0E110D') },
};

const ThemeCtx = createContext<Theme>(jour);

// Couleur de saison (option) : seul l'accent glisse, le reste du papier ne change pas.
// L'été garde le matcha d'origine.
type Accent = Pick<Theme, 'accent' | 'accentSoft' | 'selection'>;
const SEASON_ACCENTS: Record<Exclude<SeasonKind, 'ete'>, { jour: Accent; nuit: Accent }> = {
  printemps: {
    // sakura
    jour: { accent: '#A0707C', accentSoft: '#E6CDD2', selection: 'rgba(160, 112, 124, 0.30)' },
    nuit: { accent: '#D3A2AE', accentSoft: '#4F3A40', selection: 'rgba(211, 162, 174, 0.33)' },
  },
  automne: {
    // érable et kaki doré
    jour: { accent: '#A0743F', accentSoft: '#E5D3B6', selection: 'rgba(160, 116, 63, 0.30)' },
    nuit: { accent: '#D4A46A', accentSoft: '#4D3F2A', selection: 'rgba(212, 164, 106, 0.33)' },
  },
  hiver: {
    // ciel de neige
    jour: { accent: '#5E7B85', accentSoft: '#C9D7DB', selection: 'rgba(94, 123, 133, 0.30)' },
    nuit: { accent: '#9FBAC2', accentSoft: '#33444A', selection: 'rgba(159, 186, 194, 0.33)' },
  },
};

export function seasonNow(hemisphere: 'nord' | 'sud'): SeasonKind {
  return seasonOf(currentMicroSeason(new Date(), hemisphere).index);
}

export function ThemeProvider({
  mode,
  seasonal = false,
  hemisphere = 'nord',
  children,
}: {
  mode: ThemeMode;
  seasonal?: boolean;
  hemisphere?: 'nord' | 'sud';
  children: ReactNode;
}) {
  const system = useColorScheme();
  const dark = mode === 'nuit' || (mode === 'auto' && system === 'dark');
  const season = seasonal ? seasonNow(hemisphere) : 'ete';
  const value = useMemo(() => {
    const base = dark ? nuit : jour;
    if (season === 'ete') return base;
    return { ...base, ...SEASON_ACCENTS[season][dark ? 'nuit' : 'jour'] };
  }, [dark, season]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);

// Kanji des jours (dimanche = 0) et des mois
export const KANJI_DAYS = ['日', '月', '火', '水', '木', '金', '土'];
export const KANJI_MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
