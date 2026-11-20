import { Canvas, Fill, ImageShader, Shader, Skia, useFonts } from '@shopify/react-native-skia';
import { ReactNode, useMemo, useState } from 'react';
import { PixelRatio, View } from 'react-native';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { IconBtn, Txt } from './ui';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { CURL_SKSL } from '../lib/book/curl';
import { BookPage, renderPage } from '../lib/book/pages';

// 日記 — le journal en livre : la page se courbe sous le doigt et révèle la suivante.

const effect = Skia.RuntimeEffect.Make(CURL_SKSL);
type Mode = 'next' | 'prev' | null;

export function JournalBook({
  pages,
  index,
  onIndex,
  width,
  height,
  hemisphere,
}: {
  pages: BookPage[];
  index: number;
  onIndex: (i: number) => void;
  width: number;
  height: number;
  hemisphere: 'nord' | 'sud';
}) {
  const t = useTheme();
  const fonts = useFonts({
    Mincho: [require('../../assets/fonts/Mincho-Medium.ttf')],
    Gothic: [require('../../assets/fonts/Gothic-Regular.ttf')],
  });
  const scale = Math.min(3, PixelRatio.get());
  const R = Math.max(26, width * 0.1);
  const FLAT = width + R * 2;
  const TURNED = -(width + Math.PI * R * 2);

  // images des pages voisines (dessinées une fois, quand le contenu change)
  const key = (p?: BookPage) => (p ? `${p.date}|${p.entry?.mood ?? ''}|${p.entry?.text ?? ''}|${p.tasks}|${p.focus}|${p.rituals}|${p.number}` : '');
  const cur = pages[index];
  const nxt = pages[index + 1];
  const prv = pages[index - 1];
  const kc = key(cur);
  const kn = key(nxt);
  const kp = key(prv);
  /* eslint-disable react-hooks/exhaustive-deps -- les clés résument le contenu de chaque page */
  const imgCur = useMemo(() => (fonts && cur ? renderPage(cur, width, height, scale, fonts, hemisphere) : null), [fonts, kc, width, height, hemisphere]);
  const imgNext = useMemo(() => (fonts && nxt ? renderPage(nxt, width, height, scale, fonts, hemisphere) : null), [fonts, kn, width, height, hemisphere]);
  const imgPrev = useMemo(() => (fonts && prv ? renderPage(prv, width, height, scale, fonts, hemisphere) : null), [fonts, kp, width, height, hemisphere]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const [mode, setMode] = useState<Mode>(null);
  const cx = useSharedValue(FLAT);
  const angle = useSharedValue(0);

  const finish = (dir: 1 | -1) => {
    setMode(null);
    cx.set(FLAT);
    angle.set(0);
    onIndex(index + dir);
  };
  const cancel = () => {
    setMode(null);
    cx.set(FLAT);
    angle.set(0);
  };

  // boutons « page suivante / précédente »
  const turnPage = (dir: 1 | -1) => {
    if (mode) return;
    if (dir === 1 && nxt) {
      setMode('next');
      cx.set(FLAT);
      angle.set(0.12);
      cx.set(withTiming(TURNED, { duration: 900, easing: Easing.inOut(Easing.cubic) }, (ok) => ok && scheduleOnRN(finish, 1)));
    } else if (dir === -1 && prv) {
      setMode('prev');
      cx.set(TURNED);
      angle.set(0.12);
      cx.set(withTiming(FLAT, { duration: 900, easing: Easing.inOut(Easing.cubic) }, (ok) => ok && scheduleOnRN(finish, -1)));
    }
  };

  const hasNext = !!nxt;
  const hasPrev = !!prv;
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-18, 18])
    .onStart((e) => {
      if (e.translationX < 0 && hasNext) {
        scheduleOnRN(setMode, 'next');
        cx.set(FLAT);
      } else if (e.translationX > 0 && hasPrev) {
        scheduleOnRN(setMode, 'prev');
        cx.set(TURNED);
      }
    })
    .onUpdate((e) => {
      const tilt = Math.max(-0.35, Math.min(0.35, ((e.y - height / 2) / height) * 0.7));
      angle.set(tilt);
      if (e.translationX < 0 && hasNext) cx.set(Math.min(FLAT, width + R + e.translationX * 1.25));
      else if (e.translationX > 0 && hasPrev) cx.set(Math.min(FLAT, TURNED + e.translationX * 1.6));
    })
    .onEnd((e) => {
      if (e.translationX < 0 && hasNext) {
        const done = cx.get() < width * 0.55 || e.velocityX < -600;
        cx.set(withTiming(done ? TURNED : FLAT, { duration: done ? 520 : 360, easing: Easing.out(Easing.cubic) }, (ok) => ok && scheduleOnRN(done ? finish : cancel, 1)));
      } else if (e.translationX > 0 && hasPrev) {
        const done = cx.get() > width * 0.25 || e.velocityX > 600;
        cx.set(withTiming(done ? FLAT : TURNED, { duration: done ? 520 : 360, easing: Easing.out(Easing.cubic) }, (ok) => ok && scheduleOnRN(done ? finish : cancel, -1)));
      }
    });

  const uniforms = useDerivedValue(() => ({ res: [width, height], cx: cx.get(), angle: angle.get(), radius: R, paper: [0.95, 0.945, 0.9] }));

  const top = mode === 'prev' ? imgPrev : imgCur;
  const under = mode === 'next' ? imgNext : mode === 'prev' ? imgCur : imgCur;
  const controls = (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
      <IconBtn icon="chevron-left" label={tr('Page précédente')} onPress={() => turnPage(-1)} size={40} />
      <Txt v="small" color={t.muted} style={{ flex: 1, textAlign: 'center' }}>
        {tr('Page {n} sur {total} · glisse pour tourner', { n: cur?.number ?? 1, total: pages.length })}
      </Txt>
      <IconBtn icon="chevron-right" label={tr('Page suivante')} onPress={() => turnPage(1)} size={40} />
    </View>
  );
  if (!effect || !top || !under) return <BookFrame width={width} height={height} controls={controls} />;
  const rect = { x: 0, y: 0, width, height };
  return (
    <BookFrame width={width} height={height} controls={controls}>
      <GestureDetector gesture={pan}>
        <Canvas style={{ width, height }} accessibilityLabel={tr('Journal, page {n} sur {total}. Glisse pour tourner les pages.', { n: cur?.number ?? 1, total: pages.length })}>
          <Fill>
            <Shader source={effect} uniforms={uniforms}>
              <ImageShader image={top} fit="fill" rect={rect} />
              <ImageShader image={under} fit="fill" rect={rect} />
            </Shader>
          </Fill>
        </Canvas>
      </GestureDetector>
    </BookFrame>
  );
}

/** Le livre : tranche des pages à droite, ombre portée, puis les boutons. */
function BookFrame({ width, height, controls, children }: { width: number; height: number; controls: ReactNode; children?: ReactNode }) {
  return (
    <>
      <View style={{ width, height, borderRadius: 6, elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, backgroundColor: '#E7E4D3' }}>
        <View style={{ position: 'absolute', right: -5, top: 6, bottom: 6, width: 6, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: '#DDD9C6' }} />
        <View style={{ position: 'absolute', right: -9, top: 12, bottom: 12, width: 5, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: '#CFCAB4' }} />
        <View style={{ borderRadius: 6, overflow: 'hidden', width, height, backgroundColor: '#F3F1E4' }}>{children}</View>
      </View>
      {controls}
    </>
  );
}
