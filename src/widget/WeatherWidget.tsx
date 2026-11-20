import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { todayKey } from '../lib/date';
import { ageLabel, describe, isStale, rainUntilTonight, WeatherData } from '../lib/weather';
import { epure, komorebi, skyArt, skyTint, tempCurve } from './art';
import { Frame } from './Frame';
import { DARK, LIGHT, layoutOf, Look, MEDIUM, Pal, SERIF, Size, sizeOr } from './palette';
import { tr } from '../i18n';

// Widget 天気 : la météo en cache (aucun réseau ici). Elle est rafraîchie quand
// l'app s'ouvre et, dans l'APK, environ une fois par heure en arrière-plan.
// Le décor suit le ciel : soleil, lune et étoiles, nuages, pluie, brouillard.

const OPEN = { clickAction: 'OPEN_URI', clickActionData: { uri: 'kairos://meteo' } } as const;

/** Les prochaines heures à partir de maintenant (le cache peut dater de quelques heures). */
function nextHours(w: WeatherData, n: number) {
  const h = String(new Date().getHours()).padStart(2, '0');
  const from = `${todayKey()}T${h}`;
  return w.hourly.filter((x) => x.time.slice(0, 13) >= from).slice(0, n);
}

function art(w: WeatherData | null, s: Size, p: Pal, look: Look) {
  if (look === 'epure') return epure(s, p, 'meteo');
  if (!w) return komorebi(s, p, { name: 'meteo' });
  const d = describe(w.current.code, w.current.isDay);
  return komorebi(s, p, {
    name: 'meteo',
    leaves: d.sky === 'clair' && w.current.isDay,
    tint: skyTint(p, d.sky, w.current.isDay),
    extra: skyArt(s.width, s.height, p, d.sky, w.current.isDay),
  });
}

function Empty({ p, s, look }: { p: Pal; s: Size; look: Look }) {
  return (
    <Frame size={s} p={p} art={art(null, s, p, look)} mark={look === 'epure' ? undefined : '天'} click={OPEN} style={{ padding: 12, alignItems: 'center', justifyContent: 'center' }}>
      <TextWidget text="天気" style={{ fontSize: 20, fontFamily: SERIF, color: p.check }} />
      <TextWidget text={tr('Active la météo dans Kairos')} style={{ fontSize: 11, fontFamily: MEDIUM, color: p.muted }} />
    </Frame>
  );
}

function Strip({ w, p, s, look }: { w: WeatherData; p: Pal; s: Size; look: Look }) {
  const d = describe(w.current.code, w.current.isDay);
  const today = w.daily[0];
  return (
    <Frame size={s} p={p} art={art(w, s, p, look)} click={OPEN} style={{ paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
      <TextWidget text={`${Math.round(w.current.temp)}°`} style={{ fontSize: 28, fontFamily: SERIF, color: p.ink }} />
      <TextWidget text={` ${d.kanji}`} style={{ fontSize: 17, fontFamily: SERIF, color: p.check }} />
      <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 12 }}>
        <TextWidget text={tr(d.fr)} maxLines={1} truncate="END" style={{ fontSize: 13, fontFamily: MEDIUM, color: p.ink }} />
        <TextWidget
          text={today ? `↑ ${Math.round(today.max)}°  ↓ ${Math.round(today.min)}°  · ` + tr('pluie {p} %', { p: rainUntilTonight(w) }) : ''}
          maxLines={1}
          style={{ fontSize: 10, fontFamily: MEDIUM, color: p.muted }}
        />
      </FlexWidget>
    </Frame>
  );
}

/** Bloc « maintenant » : grosse température, kanji du ciel, description. */
function Now({ w, p, big, look }: { w: WeatherData; p: Pal; big: boolean; look: Look }) {
  const d = describe(w.current.code, w.current.isDay);
  const today = w.daily[0];
  const stale = isStale(w.fetchedAt);
  return (
    <FlexWidget style={{ flexDirection: 'column', height: 'match_parent', justifyContent: 'space-between' }}>
      <TextWidget
        text={stale ? ageLabel(w.fetchedAt) : look === 'epure' ? tr('maintenant') : '天気 · ' + tr('maintenant')}
        maxLines={1}
        style={{ fontSize: 10, fontFamily: stale || look === 'epure' ? MEDIUM : SERIF, color: stale ? p.accent : look === 'epure' ? p.muted : p.check }}
      />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <TextWidget text={`${Math.round(w.current.temp)}°`} style={{ fontSize: big ? 46 : 40, fontFamily: SERIF, color: p.ink }} />
        <TextWidget text={d.kanji} style={{ fontSize: 18, fontFamily: SERIF, color: p.check, marginBottom: 8, marginLeft: 4 }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column' }}>
        <TextWidget text={tr(d.fr)} maxLines={1} truncate="END" style={{ fontSize: 13.5, fontFamily: MEDIUM, color: p.ink }} />
        <TextWidget
          text={today ? `↑ ${Math.round(today.max)}°  ↓ ${Math.round(today.min)}°` : ''}
          maxLines={1}
          style={{ fontSize: 10.5, fontFamily: MEDIUM, color: p.muted }}
        />
        <TextWidget text={tr('pluie ce soir {p} %', { p: rainUntilTonight(w) })} maxLines={1} style={{ fontSize: 10.5, fontFamily: MEDIUM, color: p.muted }} />
      </FlexWidget>
    </FlexWidget>
  );
}

function Body({ w, p, s, wide, look }: { w: WeatherData; p: Pal; s: Size; wide: boolean; look: Look }) {
  const pad = 14;
  const leftW = 128;
  const hours = wide ? nextHours(w, Math.max(4, Math.min(7, Math.floor((s.width - pad * 2 - leftW) / 44)))) : [];
  const areaW = s.width - pad * 2 - leftW - 8;
  const curveH = Math.max(30, Math.min(56, s.height - pad * 2 - 64));
  return (
    <Frame size={s} p={p} art={art(w, s, p, look)} click={OPEN} style={{ padding: pad, flexDirection: 'row' }}>
      <FlexWidget style={{ width: wide ? leftW : 'match_parent', height: 'match_parent' }}>
        <Now w={w} p={p} big={!wide} look={look} />
      </FlexWidget>
      {hours.length >= 2 ? (
        <FlexWidget style={{ width: areaW, height: 'match_parent', flexDirection: 'column', justifyContent: 'center', marginLeft: 8 }}>
          <FlexWidget style={{ width: areaW, flexDirection: 'row' }}>
            {hours.map((h) => (
              <FlexWidget key={h.time} style={{ flex: 1, alignItems: 'center' }}>
                <TextWidget text={`${Math.round(h.temp)}°`} style={{ fontSize: 13, fontFamily: SERIF, color: p.ink }} />
              </FlexWidget>
            ))}
          </FlexWidget>
          <SvgWidget
            svg={tempCurve(
              areaW,
              curveH,
              hours.map((h) => h.temp),
              look === 'epure' ? hours.map(() => 0) : hours.map((h) => h.rain),
              p,
            )}
            style={{ width: areaW, height: curveH, marginVertical: 3 }}
          />
          <FlexWidget style={{ width: areaW, flexDirection: 'row' }}>
            {hours.map((h, i) => (
              <FlexWidget key={h.time} style={{ flex: 1, alignItems: 'center', flexDirection: 'column' }}>
                <TextWidget text={i === 0 ? tr('mtn') : tr('{h}h', { h: h.time.slice(11, 13) })} style={{ fontSize: 10, fontFamily: MEDIUM, color: i === 0 ? p.check : p.muted }} />
                <TextWidget text={`${h.rain}%`} style={{ fontSize: 9, fontFamily: MEDIUM, color: h.rain >= 40 ? p.ink : p.muted }} />
              </FlexWidget>
            ))}
          </FlexWidget>
        </FlexWidget>
      ) : null}
    </Frame>
  );
}

export function WeatherWidget({ weather, size, look = 'komorebi' }: { weather: WeatherData | null; size?: Size; look?: Look }) {
  const s = sizeOr(size, { width: 320, height: 160 });
  const layout = layoutOf(s);
  const render = (p: Pal) =>
    !weather ? (
      <Empty p={p} s={s} look={look} />
    ) : layout === 'bande' ? (
      <Strip w={weather} p={p} s={s} look={look} />
    ) : (
      <Body w={weather} p={p} s={s} wide={layout === 'grand'} look={look} />
    );
  return { light: render(LIGHT), dark: render(DARK) };
}
