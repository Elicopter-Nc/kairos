import { Canvas, Fill, Shader, Skia, useClock } from '@shopify/react-native-skia';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, useWindowDimensions, View } from 'react-native';
import { SensorType, useAnimatedSensor, useDerivedValue, useReducedMotion } from 'react-native-reanimated';
import { useStore } from '../data/store';
import { currentMicroSeason } from '../lib/seasons';
import { hoursOf, sunTimes } from '../lib/sun';
import { describe, Sky, useWeather } from '../lib/weather';
import { Theme, useTheme } from '../theme';

// 木漏れ日 — la lumière qui filtre à travers les feuilles.
// Un shader dessine des ombres de feuillage qui ondulent en haut de l'écran
// puis s'effacent dans le papier. La teinte suit l'heure, le feuillage glisse
// quand on incline le téléphone, des particules suivent la saison (pétales,
// lucioles, feuilles d'érable, neige) et la météo (pluie, ciel couvert).

export const KOMOREBI_SKSL = `
uniform float t;
uniform float2 res;
uniform float2 tilt;
uniform float3 paper;
uniform float3 shade;
uniform float3 sun;
uniform float dim;
uniform float pdensity;
uniform float pspeed;
uniform float psize;
uniform float paspect;
uniform float pspin;
uniform float pglow;
uniform float pdrift;
uniform float3 pcolor;

float h(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float n(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + float2(1.0, 0.0)), f.x), mix(h(i + float2(0.0, 1.0)), h(i + float2(1.0, 1.0)), f.x), f.y);
}
float fbm(float2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.03; a *= 0.5; }
  return v;
}
float particles(float2 xy) {
  float acc = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float cs = 64.0 + fi * 30.0;
    float2 p = xy;
    p.y -= t * pspeed * (0.7 + fi * 0.25);
    p.x += sin(t * 0.5 + fi * 1.7 + xy.y * 0.012) * pdrift;
    float2 cell = floor(p / cs);
    float2 f = fract(p / cs) - 0.5;
    float rnd = h(cell + fi * 17.3);
    float on = step(rnd, pdensity);
    float2 off = float2(h(cell + 3.1), h(cell + 7.7)) - 0.5;
    float2 q = (f - off * 0.6) * cs;
    float a = (t * pspin * (rnd - 0.5) * 2.0 + rnd * 6.283) * min(pspin * 10.0, 1.0);
    float2 r = float2(cos(a) * q.x - sin(a) * q.y, sin(a) * q.x + cos(a) * q.y);
    float s = psize * (0.7 + rnd * 0.6) * (1.0 - fi * 0.15);
    float d = length(r / float2(s * paspect, s));
    float shape = mix(smoothstep(1.0, 0.65, d), exp(-d * d * 1.5), pglow);
    float blink = mix(1.0, 0.5 + 0.5 * sin(t * 2.0 + rnd * 40.0), pglow);
    acc += on * shape * blink * (0.85 - fi * 0.2);
  }
  return clamp(acc, 0.0, 1.0);
}
half4 main(float2 xy) {
  float2 uv = xy / res;
  float2 p = xy / 150.0 + tilt;
  float2 sway = float2(sin(t * 0.35) * 0.18, cos(t * 0.27) * 0.12);
  float w = fbm(p * 1.3 + sway + fbm(p * 2.0 + t * 0.05));
  float leaves = smoothstep(0.42, 0.58, w);
  float canopy = smoothstep(1.0, 0.05, uv.y);
  float3 lit = mix(paper, sun, 0.55 * (1.0 - dim));
  float3 sh = mix(shade, paper, dim * 0.55);
  float3 col = mix(sh, lit, leaves);
  col = mix(paper, col, canopy * 0.9);
  float spark = pow(leaves * canopy, 6.0) * 0.18 * (1.0 - dim);
  col += spark;
  float pa = particles(xy) * smoothstep(1.0, 0.25, uv.y);
  col = mix(col, pcolor, pa * 0.9);
  return half4(col, 1.0);
}`;

const effect = Skia.RuntimeEffect.Make(KOMOREBI_SKSL);
export const komorebiEffect = effect;

type RGB = [number, number, number];
const rgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mixRGB = (a: RGB, b: RGB, k: number): RGB => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

/**
 * Couleur de la lumière selon l'heure : aube dorée au lever, midi clair, soir ambré
 * au coucher, nuit lunaire. `sun` = heures décimales du lever et du coucher réels.
 */
export function lightFor(theme: Theme, date = new Date(), sun: { rise: number; set: number } = { rise: 6.5, set: 19 }): { sun: RGB; shade: RGB } {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (theme.dark) return { sun: rgb('#36412F'), shade: theme.leaf.shade };
  const rise = Math.min(Math.max(sun.rise, 3), 10);
  const set = Math.min(Math.max(sun.set, rise + 5), 22.5);
  const raw: [number, string, string][] = [
    [0, '#E3EAEE', '#97A39E'], // nuit
    [rise - 1, '#E3EAEE', '#97A39E'],
    [rise, '#FFE0AC', '#A6AC8C'], // aube dorée
    [rise + 2.5, '#FFF6DE', '#A3B293'], // matin
    [set - 2.5, '#FFF4D6', '#A3B293'], // après-midi
    [set - 0.3, '#FFC98C', '#A79C7E'], // heure dorée
    [set + 1, '#E3EAEE', '#97A39E'], // nuit
    [24, '#E3EAEE', '#97A39E'],
  ];
  // garantit des étapes croissantes même pour des journées très courtes
  const stops = raw.map(([h, a, b], i) => [Math.max(h, i === 0 ? 0 : raw[i - 1][0] + 0.01), a, b] as [number, string, string]);
  for (let i = 0; i < stops.length - 1; i++) {
    const [h0, s0, d0] = stops[i];
    const [h1, s1, d1] = stops[i + 1];
    if (hour >= h0 && hour <= h1) {
      const k = (hour - h0) / (h1 - h0);
      return { sun: mixRGB(rgb(s0), rgb(s1), k), shade: mixRGB(rgb(d0), rgb(d1), k) };
    }
  }
  return { sun: rgb('#FFF6DE'), shade: theme.leaf.shade };
}

export interface Particles {
  name: string; // pour l'accessibilité / les réglages
  pdensity: number;
  pspeed: number;
  psize: number;
  paspect: number;
  pspin: number;
  pglow: number;
  pdrift: number;
  pcolor: RGB;
}

const NONE: Particles = { name: 'aucune', pdensity: 0, pspeed: 0, psize: 1, paspect: 1, pspin: 0, pglow: 0, pdrift: 0, pcolor: [1, 1, 1] };

/** Particules selon la micro-saison, l'heure et le ciel. La météo a priorité. */
export function particlesFor(index: number, date: Date, sky: Sky | null, dark: boolean): Particles {
  if (sky === 'pluie' || sky === 'orage' || sky === 'bruine')
    return { name: 'pluie', pdensity: sky === 'bruine' ? 0.35 : 0.6, pspeed: 260, psize: 7, paspect: 0.12, pspin: 0, pglow: 0, pdrift: 4, pcolor: dark ? rgb('#7F8E95') : rgb('#9FB2BC') };
  if (sky === 'neige') return { name: 'neige', pdensity: 0.55, pspeed: 26, psize: 2.6, paspect: 1, pspin: 0, pglow: 0, pdrift: 14, pcolor: rgb('#FFFFFF') };
  if (sky === 'brouillard') return NONE;
  const hour = date.getHours();
  const night = hour >= 19 || hour < 6;
  if (index >= 6 && index <= 20)
    return { name: 'pétales', pdensity: 0.28, pspeed: 22, psize: 4.2, paspect: 1.6, pspin: 1.2, pglow: 0, pdrift: 18, pcolor: dark ? rgb('#A87D86') : rgb('#F2C4CE') };
  if (index >= 21 && index <= 44)
    return night
      ? { name: 'lucioles', pdensity: 0.22, pspeed: -6, psize: 3.2, paspect: 1, pspin: 0, pglow: 1, pdrift: 20, pcolor: rgb('#E8F59B') }
      : { name: 'pollen', pdensity: 0.25, pspeed: -5, psize: 2.1, paspect: 1, pspin: 0, pglow: 1, pdrift: 16, pcolor: dark ? rgb('#C9D3A8') : rgb('#FFFBEA') };
  if (index >= 45 && index <= 62)
    return { name: 'feuilles d’érable', pdensity: 0.24, pspeed: 20, psize: 5.6, paspect: 1.3, pspin: 1.6, pglow: 0, pdrift: 22, pcolor: dark ? rgb('#A3573A') : rgb('#D9824A') };
  return { name: 'neige', pdensity: 0.4, pspeed: 18, psize: 2.2, paspect: 1, pspin: 0, pglow: 0, pdrift: 12, pcolor: dark ? rgb('#C9CFC4') : rgb('#FFFFFF') };
}

function dimFor(sky: Sky | null): number {
  switch (sky) {
    case 'voile':
      return 0.3;
    case 'couvert':
    case 'bruine':
      return 0.65;
    case 'pluie':
    case 'brouillard':
    case 'neige':
      return 0.75;
    case 'orage':
      return 0.85;
    default:
      return 0;
  }
}

/** Lever/coucher : d'abord la prévision du jour, sinon le calcul solaire à la dernière position connue. */
function sunHours(w: ReturnType<typeof useWeather>['data'], now: Date): { rise: number; set: number } | undefined {
  if (!w) return undefined;
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const d = w.daily.find((x) => x.date === key);
  if (d) {
    const h = (s: string) => Number(s.slice(11, 13)) + Number(s.slice(14, 16)) / 60;
    return { rise: h(d.sunrise), set: h(d.sunset) };
  }
  const st = sunTimes(now, w.lat, w.lon);
  return st ? { rise: hoursOf(st.sunrise), set: hoursOf(st.sunset) } : undefined;
}

/** Lumière, ombres et particules du moment (heure, saison, météo). */
export function useScene() {
  const t = useTheme();
  const { db } = useStore();
  const weather = useWeather(db.settings.weather);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 5 * 60 * 1000);
    return () => clearInterval(i);
  }, []);
  const sky = weather.data ? describe(weather.data.current.code, weather.data.current.isDay).sky : null;
  const season = currentMicroSeason(now, db.settings.hemisphere);
  const light = lightFor(t, now, sunHours(weather.data, now));
  const p = particlesFor(season.index, now, sky, t.dark);
  return { paper: t.leaf.paper, shade: light.shade, sun: light.sun, dim: dimFor(sky), ...p };
}

function Live({ width, height }: { width: number; height: number }) {
  const scene = useScene();
  const clock = useClock();
  const gravity = useAnimatedSensor(SensorType.GRAVITY, { interval: 32 });
  const uniforms = useDerivedValue(() => {
    const g = gravity.sensor.value;
    return {
      t: clock.value / 1000 + 11,
      res: [width, height],
      tilt: [(g.x / 9.81) * 0.6, (g.y / 9.81) * 0.25],
      paper: scene.paper,
      shade: scene.shade,
      sun: scene.sun,
      dim: scene.dim,
      pdensity: scene.pdensity,
      pspeed: scene.pspeed,
      psize: scene.psize,
      paspect: scene.paspect,
      pspin: scene.pspin,
      pglow: scene.pglow,
      pdrift: scene.pdrift,
      pcolor: scene.pcolor,
    };
  });
  if (!effect) return null;
  return (
    <Canvas style={{ width, height }}>
      <Fill>
        <Shader source={effect} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}

function Still({ width, height }: { width: number; height: number }) {
  const { name: _name, ...scene } = useScene();
  if (!effect) return null;
  return (
    <Canvas style={{ width, height }}>
      <Fill>
        <Shader source={effect} uniforms={{ t: 14, res: [width, height], tilt: [0, 0], ...scene, pdensity: scene.pdensity * 0.6 }} />
      </Fill>
    </Canvas>
  );
}

/** Fond komorebi à placer en haut d'un écran (position absolue). */
export function Komorebi({ height = 420, offsetX = 0 }: { height?: number; offsetX?: number }) {
  const { width } = useWindowDimensions();
  const { db } = useStore();
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  const animate = db.settings.ambiance && focused && active && !reduced;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: offsetX, width, height }}>
      {animate ? <Live width={width} height={height} /> : <Still width={width} height={height} />}
    </View>
  );
}
