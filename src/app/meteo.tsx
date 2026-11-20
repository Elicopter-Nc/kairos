import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { close } from '../components/editor';
import { Komorebi } from '../components/Komorebi';
import { Btn, Card, Empty, Grain, IconBtn, IconName, Section, Txt } from '../components/ui';
import { useStore } from '../data/store';
import { capitalize, DAYS_LONG, fromKey } from '../lib/date';
import { ageLabel, describe, rainUntilTonight, useWeather, weatherLine } from '../lib/weather';
import { tr } from '../i18n';
import { useTheme } from '../theme';

// 天気 — la météo en détail : maintenant, les prochaines heures, la semaine.
export default function Meteo() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { db, updateSettings } = useStore();
  const { data, loading, error, refresh } = useWeather(db.settings.weather);

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <IconBtn icon="chevron-down" label={tr('Fermer')} onPress={close} size={40} />
      <View style={{ flex: 1 }} />
      {db.settings.weather ? (
        <Pressable onPress={refresh} accessibilityLabel={tr('Actualiser la météo')} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          {loading ? <ActivityIndicator color={t.accent} /> : <Feather name="refresh-cw" size={18} color={t.accent} />}
        </Pressable>
      ) : null}
    </View>
  );

  if (!db.settings.weather) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 8, paddingHorizontal: 20 }}>
        <Komorebi height={320} />
        {header}
        <Empty jp="天" title={tr('Météo désactivée')} hint={tr('Les prévisions viennent d’Open-Meteo (gratuit, sans compte). Ta position, arrondie à environ 1 km, leur est envoyée. La dernière météo reste affichée hors-ligne.')} />
        <Btn label={tr('Activer la météo')} icon="cloud" onPress={() => updateSettings({ weather: true })} style={{ alignSelf: 'center' }} />
        <Grain />
      </View>
    );
  }

  const week = data?.daily ?? [];
  const lo = Math.min(...week.map((d) => d.min));
  const hi = Math.max(...week.map((d) => d.max));
  const span = Math.max(1, hi - lo);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <Komorebi height={420 + insets.top} />
        {header}
        {!data ? (
          <Empty jp="天" title={loading ? tr('Lecture du ciel…') : tr('Pas encore de météo')} hint={error ?? tr('Il faut une connexion la première fois.')} />
        ) : (
          <>
            <Txt v="kicker" color={t.muted}>
              {tr('{place} · mis à jour {age}', { place: data.place ?? tr('Ta position'), age: ageLabel(data.fetchedAt) })}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 6 }}>
              <Txt style={{ fontFamily: t.font.mincho, fontSize: 96, lineHeight: 104, letterSpacing: -3 }}>{Math.round(data.current.temp)}°</Txt>
              <View style={{ paddingBottom: 16, flex: 1 }}>
                <Txt v="jp" color={t.accent} style={{ fontSize: 26, letterSpacing: 0 }}>
                  {describe(data.current.code, data.current.isDay).kanji}
                </Txt>
                <Txt v="h2">{describe(data.current.code, data.current.isDay).fr}</Txt>
                <Txt v="small" color={t.muted}>
                  {tr('Ressenti {n}°', { n: Math.round(data.current.feels) })}
                </Txt>
              </View>
            </View>
            <Txt style={{ fontFamily: t.font.mincho, fontSize: 17, lineHeight: 26, color: t.inkSoft, marginTop: 6 }}>{weatherLine(data)}</Txt>
            {error ? (
              <Txt v="small" color={t.kaki} style={{ marginTop: 6 }}>
                {tr('Actualisation impossible : {error}', { error })}
              </Txt>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Stat icon="sunrise" label={tr('Lever')} value={week[0]?.sunrise.slice(11, 16) ?? '—'} />
              <Stat icon="sunset" label={tr('Coucher')} value={week[0]?.sunset.slice(11, 16) ?? '—'} />
              <Stat icon="wind" label={tr('Vent')} value={`${Math.round(data.current.wind)} km/h`} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Stat icon="droplet" label={tr('Humidité')} value={`${data.current.humidity} %`} />
              <Stat icon="umbrella" label={tr('Pluie ce soir')} value={`${rainUntilTonight(data)} %`} />
              <Stat icon="sun" label={tr('UV max')} value={`${Math.round(week[0]?.uv ?? 0)}`} />
            </View>

            <Section jp="時" title={tr('Prochaines heures')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
                {data.hourly.map((h, i) => {
                  const hd = describe(h.code, true);
                  return (
                    <Card key={h.time} bg={i === 0 ? t.accentSoft : undefined} bordered={i !== 0} radius={16} contentStyle={{ alignItems: 'center', width: 58, paddingVertical: 10, gap: 4 }}>
                      <Txt v="small" color={t.muted}>
                        {i === 0 ? tr('Mtn') : tr('{h}h', { h: h.time.slice(11, 13) })}
                      </Txt>
                      <Feather name={hd.icon} size={17} color={t.inkSoft} />
                      <Txt v="num">{Math.round(h.temp)}°</Txt>
                      <Txt v="small" color={h.rain >= 40 ? t.accent : t.muted} style={{ fontSize: 10.5 }}>
                        {h.rain}%
                      </Txt>
                    </Card>
                  );
                })}
              </ScrollView>
            </Section>

            <Section jp="週" title={tr('Semaine')}>
              <Card radius={20} contentStyle={{ paddingVertical: 6 }}>
                {week.map((d, i) => {
                  const dd = describe(d.code, true);
                  const left = ((d.min - lo) / span) * 100;
                  const width = Math.max(6, ((d.max - d.min) / span) * 100);
                  return (
                    <View key={d.date} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: i ? StyleSheet.hairlineWidth * 2 : 0, borderColor: t.line }}>
                      <Txt v="body" style={{ width: 82 }} numberOfLines={1}>
                        {i === 0 ? tr("Aujourd'hui") : capitalize(DAYS_LONG[fromKey(d.date).getDay()])}
                      </Txt>
                      <Txt v="jp" color={t.accent} style={{ width: 30, fontSize: 14, letterSpacing: 0 }}>
                        {dd.kanji}
                      </Txt>
                      <Txt v="num" color={t.muted} style={{ width: 30, textAlign: 'right', fontSize: 13 }}>
                        {Math.round(d.min)}°
                      </Txt>
                      <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: t.bgAlt }}>
                        <View style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: 5, borderRadius: 3, backgroundColor: t.accent }} />
                      </View>
                      <Txt v="num" style={{ width: 30, fontSize: 13 }}>
                        {Math.round(d.max)}°
                      </Txt>
                    </View>
                  );
                })}
              </Card>
            </Section>

            <Txt v="small" color={t.muted} style={{ textAlign: 'center', marginTop: 24 }}>
              {tr('Données Open-Meteo · position arrondie à ~1 km')}
            </Txt>
          </>
        )}
      </ScrollView>
      <Grain />
    </View>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1 }} radius={16} contentStyle={{ padding: 12, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Feather name={icon} size={13} color={t.accent} />
        <Txt v="small" color={t.muted} style={{ fontSize: 11 }}>
          {label}
        </Txt>
      </View>
      <Txt v="num" style={{ fontSize: 16 }}>
        {value}
      </Txt>
    </Card>
  );
}
