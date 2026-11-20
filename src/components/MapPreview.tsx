import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { currentPositionRounded, OSM_HEADERS, routeMinutes, tileUrl, toTile, TravelMode } from '../lib/geo';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { Txt } from './ui';

const TILE = 256;
const ZOOM = 15;

/**
 * Mini-carte OpenStreetMap (tuiles assemblées) avec un marqueur sauge.
 * Toucher → ouvre l'app de cartes du téléphone.
 */
export function MapPreview({ lat, lon, label, height = 150, mode }: { lat: number; lon: number; label: string; height?: number; mode?: TravelMode }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (!mode) return;
    let alive = true;
    (async () => {
      const here = await currentPositionRounded(false);
      if (!here) return;
      const m = await routeMinutes(here, { lat, lon }, mode);
      if (alive) setMinutes(m);
    })();
    return () => {
      alive = false;
    };
  }, [lat, lon, mode]);

  const { x, y } = toTile(lat, lon, ZOOM);
  const cx = x * TILE;
  const cy = y * TILE;
  const left = cx - width / 2;
  const top = cy - height / 2;
  const tiles: { tx: number; ty: number }[] = [];
  if (width > 0) {
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + width) / TILE); tx++)
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) tiles.push({ tx, ty });
  }

  const open = () => {
    const q = encodeURIComponent(`${lat},${lon}(${label})`);
    Linking.openURL(`geo:${lat},${lon}?q=${q}`).catch(() =>
      Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`).catch(() => {}),
    );
  };

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={tr('Carte : {label}. Ouvrir dans l’application de cartes', { label })}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height, borderRadius: 18, overflow: 'hidden', backgroundColor: t.bgAlt, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line }}
      >
        {tiles.map(({ tx, ty }) => (
          <Image
            key={`${tx}-${ty}`}
            source={{ uri: tileUrl(tx, ty, ZOOM), headers: OSM_HEADERS }}
            cachePolicy="disk"
            style={{ position: 'absolute', left: tx * TILE - left, top: ty * TILE - top, width: TILE, height: TILE, opacity: t.dark ? 0.75 : 1 }}
          />
        ))}
        {/* voile léger pour garder l'ambiance papier */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.dark ? 'rgba(24,28,22,0.25)' : 'rgba(238,240,229,0.18)' }]} />
        {width > 0 ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: width / 2 - 14, top: height / 2 - 14, width: 28, height: 28, borderRadius: 14, backgroundColor: t.accent + '40', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.accent, borderWidth: 2, borderColor: t.card }} />
          </View>
        ) : null}
        <View pointerEvents="none" style={{ position: 'absolute', right: 6, bottom: 4, backgroundColor: 'rgba(248,248,241,0.85)', borderRadius: 6, paddingHorizontal: 5 }}>
          <Txt v="small" color="#4A5547" style={{ fontSize: 9.5 }}>
            © OpenStreetMap
          </Txt>
        </View>
      </Pressable>
      {mode && minutes !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name={mode === 'car' ? 'navigation' : mode === 'bike' ? 'wind' : 'user'} size={12} color={t.muted} />
          <Txt v="small" color={t.muted}>
            {mode === 'car' ? tr('~{n} min en voiture depuis ta position', { n: minutes }) : mode === 'bike' ? tr('~{n} min à vélo depuis ta position', { n: minutes }) : tr('~{n} min à pied depuis ta position', { n: minutes })}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
