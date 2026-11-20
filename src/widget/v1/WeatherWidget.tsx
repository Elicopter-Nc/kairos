import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { todayKey } from '../../lib/date';
import { ageLabel, describe, isStale, rainUntilTonight, WeatherData } from '../../lib/weather';
import { DARK, LIGHT, layoutOf, MEDIUM, Pal, SERIF, Size } from '../palette';
import { tr } from '../../i18n';

// Widget 天気 : la météo en cache (aucun réseau ici). Elle est rafraîchie quand
// l'app s'ouvre et, dans l'APK, environ une fois par heure en arrière-plan.

const OPEN = { clickAction: 'OPEN_URI', clickActionData: { uri: 'kairos://meteo' } } as const;

/** Les prochaines heures à partir de maintenant (le cache peut dater de quelques heures). */
function nextHours(w: WeatherData, n: number) {
  const h = String(new Date().getHours()).padStart(2, '0');
  const from = `${todayKey()}T${h}`;
  return w.hourly.filter((x) => x.time.slice(0, 13) >= from).slice(1, n + 1);
}

function Empty({ p }: { p: Pal }) {
  return (
    <FlexWidget {...OPEN} style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 22, padding: 12, alignItems: 'center', justifyContent: 'center' }}>
      <TextWidget text="天気" style={{ fontSize: 20, fontFamily: SERIF, color: p.check }} />
      <TextWidget text={tr('Active la météo dans Kairos')} style={{ fontSize: 11, fontFamily: MEDIUM, color: p.muted }} />
    </FlexWidget>
  );
}

function Strip({ w, p }: { w: WeatherData; p: Pal }) {
  const d = describe(w.current.code, w.current.isDay);
  const today = w.daily[0];
  return (
    <FlexWidget {...OPEN} style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 22, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
      <TextWidget text={d.kanji} style={{ fontSize: 20, fontFamily: SERIF, color: p.check }} />
      <TextWidget text={` ${Math.round(w.current.temp)}°`} style={{ fontSize: 24, fontFamily: SERIF, color: p.ink }} />
      <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 10 }}>
        <TextWidget text={tr(d.fr)} maxLines={1} truncate="END" style={{ fontSize: 13, fontFamily: MEDIUM, color: p.ink }} />
        <TextWidget
          text={today ? `${Math.round(today.max)}° / ${Math.round(today.min)}° · ` + tr('pluie {p} %', { p: rainUntilTonight(w) }) : ''}
          maxLines={1}
          style={{ fontSize: 10, fontFamily: MEDIUM, color: p.muted }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

function Now({ w, p }: { w: WeatherData; p: Pal }) {
  const d = describe(w.current.code, w.current.isDay);
  const today = w.daily[0];
  const stale = isStale(w.fetchedAt);
  return (
    <FlexWidget style={{ flexDirection: 'column', height: 'match_parent', justifyContent: 'space-between' }}>
      <TextWidget text={stale ? ageLabel(w.fetchedAt) : w.place ?? tr('Ici')} maxLines={1} truncate="END" style={{ fontSize: 10, fontFamily: MEDIUM, color: stale ? p.accent : p.muted }} />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <TextWidget text={`${Math.round(w.current.temp)}°`} style={{ fontSize: 38, fontFamily: SERIF, color: p.ink }} />
        <TextWidget text={` ${d.kanji}`} style={{ fontSize: 18, fontFamily: SERIF, color: p.check }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column' }}>
        <TextWidget text={tr(d.fr)} maxLines={1} truncate="END" style={{ fontSize: 13, fontFamily: MEDIUM, color: p.ink }} />
        <TextWidget
          text={today ? `${Math.round(today.max)}° / ${Math.round(today.min)}° · ` + tr('pluie {p} %', { p: rainUntilTonight(w) }) : ''}
          maxLines={1}
          style={{ fontSize: 10.5, fontFamily: MEDIUM, color: p.muted }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

function Body({ w, p, wide }: { w: WeatherData; p: Pal; wide: boolean }) {
  const hours = wide ? nextHours(w, 5) : [];
  return (
    <FlexWidget {...OPEN} style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 22, padding: 14, flexDirection: 'row' }}>
      <Now w={w} p={p} />
      {hours.length ? (
        <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginLeft: 12 }}>
          {hours.map((h) => (
            <FlexWidget key={h.time} style={{ flexDirection: 'column', alignItems: 'center' }}>
              <TextWidget text={tr('{h}h', { h: h.time.slice(11, 13) })} style={{ fontSize: 10, fontFamily: MEDIUM, color: p.muted }} />
              <TextWidget text={describe(h.code, true).kanji.slice(0, 1)} style={{ fontSize: 15, fontFamily: SERIF, color: p.check }} />
              <TextWidget text={`${Math.round(h.temp)}°`} style={{ fontSize: 14, fontFamily: SERIF, color: p.ink }} />
              <TextWidget text={`${h.rain}%`} style={{ fontSize: 9.5, fontFamily: MEDIUM, color: h.rain >= 40 ? p.check : p.muted }} />
            </FlexWidget>
          ))}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

export function WeatherWidget({ weather, size }: { weather: WeatherData | null; size?: Size }) {
  const layout = layoutOf(size);
  const render = (p: Pal) =>
    !weather ? <Empty p={p} /> : layout === 'bande' ? <Strip w={weather} p={p} /> : <Body w={weather} p={p} wide={layout === 'grand'} />;
  return { light: render(LIGHT), dark: render(DARK) };
}
