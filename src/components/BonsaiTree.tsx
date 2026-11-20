import { BlurStyle, Canvas, Fill, Picture, Shader, Skia, SkCanvas, TileMode, useClock, vec } from '@shopify/react-native-skia';
import { useIsFocused } from 'expo-router';
import { useMemo } from 'react';
import { Pressable } from 'react-native';
import { useDerivedValue, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { tr } from '../i18n';
import { drawBonsai, Scene, Season, SkApi } from '../lib/bonsai/draw';
import { Bonsai, fitTree, restPositions } from '../lib/bonsai/tree';
import { komorebiEffect, useScene } from './Komorebi';

// 盆栽 — le bonsaï de l'année, redessiné à chaque image (vent, pétales qui tombent).

function mkPaint(hex: string, alpha = 1) {
  'worklet';
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(hex));
  p.setAlphaf(alpha);
  return p;
}
function mkPath() {
  'worklet';
  return Skia.PathBuilder.Make();
}
function mkBlur(p: ReturnType<typeof Skia.Paint>, sigma: number) {
  'worklet';
  p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, sigma, true));
}
function mkStroke(p: ReturnType<typeof Skia.Paint>, width: number) {
  'worklet';
  p.setStyle(1);
  p.setStrokeWidth(width);
}
function mkOval(canvas: SkCanvas, cx: number, cy: number, rx: number, ry: number, p: ReturnType<typeof Skia.Paint>) {
  'worklet';
  canvas.drawOval(Skia.XYWHRect(cx - rx, cy - ry, rx * 2, ry * 2), p);
}
function mkVgrad(y0: number, y1: number, top: string, bottom: string) {
  'worklet';
  const p = Skia.Paint();
  p.setShader(Skia.Shader.MakeLinearGradient(vec(0, y0), vec(0, y1), [Skia.Color(top), Skia.Color(bottom)], null, TileMode.Clamp));
  return p;
}

export function BonsaiTree({
  tree,
  width,
  height,
  dark,
  season,
  selected,
  falling,
  onSelect,
}: {
  tree: Bonsai;
  width: number;
  height: number;
  dark: boolean;
  season: Season;
  selected: string;
  falling: boolean;
  onSelect: (date: string | null) => void;
}) {
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const clock = useClock();
  const shakeAt = useSharedValue(-10);
  const fit = useMemo(() => fitTree(tree.nodes, width, height), [tree.nodes, width, height]);
  const nodes = tree.nodes;
  const visible = tree.visible;
  const pads = tree.pads;
  const selNode = pads.find((p) => p.date && p.date === selected)?.node ?? -1;
  const backdrop = !!komorebiEffect;

  // fond : la lumière komorebi du Focus (ombres de feuillage, particules de saison)
  const scene = useScene();
  const uniforms = useDerivedValue(() => ({
    t: (reduced || !focused ? 14 : clock.get() / 1000) + 11,
    res: [width, height],
    tilt: [0, 0],
    paper: scene.paper,
    shade: scene.shade,
    sun: scene.sun,
    dim: scene.dim,
    pdensity: scene.pdensity * 0.7,
    pspeed: scene.pspeed,
    psize: scene.psize,
    paspect: scene.paspect,
    pspin: scene.pspin,
    pglow: scene.pglow,
    pdrift: scene.pdrift,
    pcolor: scene.pcolor,
  }));

  const picture = useDerivedValue(() => {
    const t = reduced || !focused ? 3 : clock.get() / 1000;
    const S: SkApi = { paint: mkPaint, path: mkPath, blur: mkBlur, stroke: mkStroke, oval: mkOval, vgrad: mkVgrad };
    const rec = Skia.PictureRecorder();
    const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    const since = t - shakeAt.get();
    const sc: Scene = { w: width, h: height, t, dark, season, shake: since >= 0 && since < 3 ? Math.exp(-since * 1.6) : 0, selected: selNode, falling: falling && !reduced, backdrop, ...fit };
    drawBonsai(canvas, S, nodes, visible, pads, sc);
    return rec.finishRecordingAsPicture();
  });

  // toucher : un coup de vent, et le nuage de feuillage touché montre son jour
  const onPress = (x: number, y: number) => {
    shakeAt.set(reduced || !focused ? 3 : clock.get() / 1000);
    const pos = restPositions(nodes, visible, fit.scale, fit.ox, fit.oy);
    let best: string | null = null;
    let bestD = Infinity;
    for (const p of pads) {
      const dx = x - pos[p.node * 2];
      const dy = (y - pos[p.node * 2 + 1]) * 1.6;
      const d = dx * dx + dy * dy;
      const r = fit.scale * 0.07 * p.size;
      if (d < r * r * 2.2 && d < bestD && p.date) {
        bestD = d;
        best = p.date;
      }
    }
    onSelect(best);
  };

  return (
    <Pressable
      onPress={(e) => onPress(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      accessibilityRole="button"
      accessibilityLabel={tr('Bonsaï : {active} jours actifs, {pads} nuages de feuillage. Touche une branche pour voir son jour.', { active: tree.active, pads: pads.length })}
    >
      <Canvas style={{ width, height }} pointerEvents="none">
        {komorebiEffect ? (
          <Fill>
            <Shader source={komorebiEffect} uniforms={uniforms} />
          </Fill>
        ) : null}
        <Picture picture={picture} />
      </Canvas>
    </Pressable>
  );
}
