import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useStore } from '../data/store';
import { ageLabel, describe, isStale, useWeather, weatherLine } from '../lib/weather';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { Card, Txt } from './ui';

/** Carte météo de l'écran Jour. Rien n'est affiché si la météo est désactivée. */
export function WeatherCard() {
  const t = useTheme();
  const { db } = useStore();
  const { data, loading, error } = useWeather(db.settings.weather);
  if (!db.settings.weather) return null;

  if (!data) {
    return (
      <Card style={{ marginTop: 14 }} contentStyle={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }} onPress={() => router.push('/meteo')}>
        <Txt v="jp" color={t.accent} style={{ fontSize: 22, letterSpacing: 0 }}>
          天
        </Txt>
        <Txt v="small" color={t.muted} style={{ flex: 1 }}>
          {loading ? tr('Lecture du ciel…') : error ?? tr('Météo indisponible pour le moment.')}
        </Txt>
      </Card>
    );
  }

  const d = describe(data.current.code, data.current.isDay);
  const today = data.daily[0];
  const hours = data.hourly.slice(1, 9);
  const stale = isStale(data.fetchedAt);

  return (
    <Card style={{ marginTop: 14 }} radius={22} onPress={() => router.push('/meteo')} accessibilityLabel={tr('Météo : {desc}, {temp} degrés', { desc: d.fr, temp: Math.round(data.current.temp) })} contentStyle={{ paddingTop: 14, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 14 }}>
        <Txt v="jp" color={t.accent} style={{ fontSize: d.kanji.length > 1 ? 22 : 30, letterSpacing: 0, width: 44, textAlign: 'center' }}>
          {d.kanji}
        </Txt>
        <Txt style={{ fontFamily: t.font.mincho, fontSize: 40, lineHeight: 48 }}>{Math.round(data.current.temp)}°</Txt>
        <View style={{ flex: 1 }}>
          <Txt v="bodyB">{d.fr}</Txt>
          <Txt v="small" color={t.muted}>
            {today ? `${Math.round(today.min)}° · ${Math.round(today.max)}°` : ''}
            {data.place ? ` · ${data.place}` : ''}
          </Txt>
        </View>
        <Feather name="chevron-right" size={16} color={t.muted} />
      </View>
      <Txt v="small" color={t.inkSoft} style={{ paddingHorizontal: 16, marginTop: 8 }}>
        {weatherLine(data)}
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 4, marginTop: 10 }}>
        {hours.map((h) => {
          const hd = describe(h.code, true);
          return (
            <View key={h.time} style={{ alignItems: 'center', width: 44, gap: 3, paddingVertical: 6, borderRadius: 12 }}>
              <Txt v="small" color={t.muted} style={{ fontSize: 11 }}>
                {tr('{h}h', { h: h.time.slice(11, 13) })}
              </Txt>
              <Feather name={hd.icon} size={15} color={t.inkSoft} />
              <Txt v="num" style={{ fontSize: 13 }}>
                {Math.round(h.temp)}°
              </Txt>
              <Txt v="small" color={h.rain >= 40 ? t.accent : t.muted} style={{ fontSize: 10 }}>
                {h.rain}%
              </Txt>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ borderTopWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, marginHorizontal: 16, marginTop: 6, paddingTop: 8 }}>
        <Txt v="small" color={stale ? t.kaki : t.muted} style={{ fontSize: 11 }}>
          {stale ? tr('Hors-ligne · mis à jour {age}', { age: ageLabel(data.fetchedAt) }) : tr('mis à jour {age}', { age: ageLabel(data.fetchedAt) })}
        </Txt>
      </View>
    </Card>
  );
}
