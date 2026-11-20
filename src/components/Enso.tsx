import { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';

// 円相 — cercle tracé d'un seul geste. Sert de jauge (journée, focus, rituels).
// Deux traits superposés d'épaisseurs différentes imitent le pinceau.
export function Enso({
  size = 64,
  progress,
  stroke = 5,
  color,
  fill,
  children,
}: {
  size?: number;
  progress: number; // 0 → 1
  stroke?: number;
  color?: string;
  fill?: string; // disque plein à l'intérieur (dessiné en SVG : toujours bien rond)
  children?: ReactNode;
}) {
  const t = useTheme();
  const c = color ?? t.accent;
  const r = (size - stroke * 2) / 2;
  const L = 2 * Math.PI * r;
  const p = Math.min(1, progress) * 0.94; // on laisse toujours l'ouverture de l'enso
  const visible = progress > 0.01;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-100deg' }] }}>
        {fill ? <Circle cx={size / 2} cy={size / 2} r={Math.max(0, r - stroke * 1.4)} fill={fill} /> : null}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.line} strokeWidth={1} fill="none" />
        {visible ? (
          <>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${L * p} ${L}`}
          opacity={0.9}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r - stroke * 0.35}
          stroke={c}
          strokeWidth={stroke * 0.35}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${L * p * 0.82} ${L}`}
          opacity={0.55}
        />
          </>
        ) : null}
      </Svg>
      {children}
    </View>
  );
}
