import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { CalEvent } from '../data/types';
import { Place, searchPlaces } from '../lib/geo';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { tap, Txt } from './ui';

type Geo = NonNullable<CalEvent['geo']>;

/**
 * Champ « Lieu » avec suggestions OpenStreetMap pendant la saisie.
 * Choisir une suggestion renseigne le lieu ET ses coordonnées ; retoucher le texte
 * ensuite efface les coordonnées (elles ne correspondraient plus).
 */
export function PlacePicker({ value, geo, onChange }: { value?: string; geo?: Geo; onChange: (location: string, geo?: Geo) => void }) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = value ?? '';
  const settled = !!geo && geo.query === text;

  useEffect(() => {
    if (!focused || settled || text.trim().length < 3) return;
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await searchPlaces(text);
        if (alive) setResults(r);
      } catch {
        if (alive) setError(tr('Pas de suggestions (hors-ligne ?)'));
      } finally {
        if (alive) setLoading(false);
      }
    }, 600);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [text, focused, settled]);

  const showList = focused && !settled && text.trim().length >= 3 && (results.length > 0 || loading || !!error);

  return (
    <View style={{ marginBottom: 16 }}>
      <Txt v="kicker" color={t.muted} style={{ marginBottom: 6 }}>
        {tr('Lieu')}
      </Txt>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: focused ? t.accent : t.line,
          borderRadius: 14,
          backgroundColor: t.card,
          paddingHorizontal: 14,
        }}
      >
        <Feather name="map-pin" size={15} color={geo ? t.accent : t.muted} />
        <TextInput
          value={text}
          onChangeText={(v) => {
            setResults([]);
            onChange(v, undefined);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={tr('Adresse, lieu, ville…')}
          placeholderTextColor={t.muted}
          selectionColor={t.selection}
          cursorColor={t.accent}
          selectionHandleColor={t.accent}
          style={{ flex: 1, fontFamily: t.font.regular, fontSize: 15.5, color: t.ink, paddingVertical: 12 }}
        />
        {loading ? <ActivityIndicator size="small" color={t.accent} /> : null}
        {!loading && geo ? <Feather name="check" size={15} color={t.accent} accessibilityLabel={tr('Lieu trouvé sur la carte')} /> : null}
      </View>
      {showList ? (
        <View style={{ marginTop: 6, borderRadius: 14, backgroundColor: t.card, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, overflow: 'hidden' }}>
          {error && !results.length ? (
            <Txt v="small" color={t.muted} style={{ padding: 12 }}>
              {error}
            </Txt>
          ) : null}
          {results.map((p, i) => (
            <Pressable
              key={`${p.lat},${p.lon},${i}`}
              onPress={() => {
                tap();
                onChange(p.label, { lat: p.lat, lon: p.lon, label: p.label, query: p.label });
                setResults([]);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                backgroundColor: pressed ? t.bgAlt : 'transparent',
                borderTopWidth: i ? StyleSheet.hairlineWidth * 2 : 0,
                borderColor: t.line,
              })}
            >
              <Feather name="map-pin" size={14} color={t.accent} style={{ marginTop: 3 }} />
              <View style={{ flex: 1 }}>
                <Txt v="body" numberOfLines={1}>
                  {p.label}
                </Txt>
                <Txt v="small" color={t.muted} numberOfLines={1}>
                  {p.detail}
                </Txt>
              </View>
            </Pressable>
          ))}
          <Txt v="small" color={t.muted} style={{ fontSize: 10, paddingHorizontal: 14, paddingBottom: 6, paddingTop: 2, textAlign: 'right' }}>
            {tr('Recherche © OpenStreetMap')}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
