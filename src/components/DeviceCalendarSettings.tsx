import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useStore } from '../data/store';
import { calendarPermission, DeviceCalendarInfo, invalidateDeviceEvents, listDeviceCalendars } from '../lib/deviceCalendar';
import { tr, trn } from '../i18n';
import { useTheme } from '../theme';
import { Btn, Card, Divider, Toggle, Txt } from './ui';

/** Bloc de l'écran Plus : choisir les calendriers du téléphone affichés dans Kairos. */
export function DeviceCalendarSettings() {
  const t = useTheme();
  const { db, updateSettings } = useStore();
  const selected = db.settings.deviceCalendars ?? [];
  const [perm, setPerm] = useState<'granted' | 'denied' | 'undetermined' | 'loading'>('loading');
  const [cals, setCals] = useState<DeviceCalendarInfo[]>([]);

  const load = async (ask: boolean) => {
    const p = await calendarPermission(ask);
    setPerm(p);
    if (p === 'granted') {
      try {
        setCals(await listDeviceCalendars());
      } catch {
        setCals([]);
      }
    }
  };

  useEffect(() => {
    let alive = true;
    calendarPermission(false).then((p) => {
      if (!alive) return;
      setPerm(p);
      if (p === 'granted') listDeviceCalendars().then((c) => alive && setCals(c), () => {});
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...new Set([...selected, id])] : selected.filter((x) => x !== id);
    invalidateDeviceEvents();
    updateSettings({ deviceCalendars: next });
  };

  return (
    <Card radius={20}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 }}>
        <Feather name="smartphone" size={17} color={t.accent} />
        <View style={{ flex: 1 }}>
          <Txt v="body">{tr('Calendriers du téléphone')}</Txt>
          <Txt v="small" color={t.muted}>
            {perm === 'granted'
              ? selected.length
                ? trn(selected.length, '{n} affiché dans l’Agenda', '{n} affichés dans l’Agenda')
                : tr('Choisis ceux à afficher dans l’Agenda')
              : tr('Lecture seule, rien ne quitte le téléphone')}
          </Txt>
        </View>
      </View>

      {perm === 'granted' ? (
        cals.length ? (
          cals.map((c) => (
            <View key={c.id}>
              <Divider />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 11 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.color, marginLeft: 3 }} />
                <View style={{ flex: 1 }}>
                  <Txt v="body" numberOfLines={1}>
                    {c.title}
                  </Txt>
                  {c.account ? (
                    <Txt v="small" color={t.muted} numberOfLines={1}>
                      {c.account}
                    </Txt>
                  ) : null}
                </View>
                <Toggle value={selected.includes(c.id)} onChange={(v) => toggle(c.id, v)} />
              </View>
            </View>
          ))
        ) : (
          <View style={{ borderTopWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, padding: 16 }}>
            <Txt v="small" color={t.muted}>
              {tr('Aucun calendrier trouvé sur ce téléphone.')}
            </Txt>
          </View>
        )
      ) : perm === 'loading' ? null : (
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, padding: 16, gap: 10 }}>
          {perm === 'denied' ? (
            <Txt v="small" color={t.muted}>
              {tr('L’accès aux calendriers a été refusé. Tu peux l’autoriser dans les réglages Android.')}
            </Txt>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn label={tr('Autoriser l’accès')} icon="unlock" small onPress={() => load(true)} />
            {perm === 'denied' ? <Btn label={tr('Réglages Android')} kind="plain" small onPress={() => Linking.openSettings()} /> : null}
          </View>
        </View>
      )}
    </Card>
  );
}
