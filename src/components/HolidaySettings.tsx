import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useStore } from '../data/store';
import { FERIES_ZONES, feriesLabel, useHolidays, VACANCES_ZONES, vacancesLabel } from '../lib/holidays';
import { ageLabel } from '../lib/weather';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { Card, Divider, Row, Sheet, tap, Txt } from './ui';

type Which = 'feries' | 'vacances' | null;

/** Bloc de réglages (écran Plus) : zone des jours fériés et des vacances scolaires. */
export function HolidaySettings() {
  const t = useTheme();
  const { db, updateSettings } = useStore();
  const h = db.settings.holidays ?? { feries: null, vacances: null };
  const state = useHolidays();
  const [open, setOpen] = useState<Which>(null);

  const options = open === 'feries' ? FERIES_ZONES : VACANCES_ZONES;
  const current = open === 'feries' ? h.feries : h.vacances;
  const choose = (id: string | null) => {
    tap();
    updateSettings({ holidays: { ...h, [open === 'feries' ? 'feries' : 'vacances']: id } });
    setOpen(null);
  };

  return (
    <>
      <Card radius={20}>
        <Row icon="flag" label={tr('Jours fériés')} value={feriesLabel(h.feries)} onPress={() => setOpen('feries')} />
        <Divider />
        <Row icon="sun" label={tr('Vacances scolaires')} value={vacancesLabel(h.vacances)} onPress={() => setOpen('vacances')} />
        {h.feries || h.vacances ? (
          <>
            <Divider />
            <Row
              icon="refresh-cw"
              label={state.loading ? tr('Mise à jour…') : state.updatedAt ? tr('Mis à jour {age}', { age: ageLabel(state.updatedAt) }) : tr('Pas encore téléchargé')}
              onPress={state.refresh}
            />
          </>
        ) : null}
      </Card>
      {state.error ? (
        <Txt v="small" color={t.kaki} style={{ marginTop: 8 }}>
          {state.error}
        </Txt>
      ) : null}
      <Txt v="small" color={t.muted} style={{ marginTop: 8 }}>
        {tr('Données publiques (api.gouv.fr, data.education.gouv.fr), mises à jour une fois par semaine. Seule la zone choisie est demandée, rien de personnel n’est envoyé. Hors-ligne, la dernière version reste affichée.')}
      </Txt>

      <Sheet visible={open !== null} onClose={() => setOpen(null)} title={open === 'feries' ? tr('Jours fériés') : tr('Vacances scolaires')}>
        <ScrollView style={{ maxHeight: 460 }}>
          {[{ id: null as string | null, label: open === 'feries' ? tr('Masquer les jours fériés') : tr('Masquer les vacances') }, ...options].map((z) => {
            const active = current === z.id;
            return (
              <Pressable
                key={z.id ?? 'none'}
                onPress={() => choose(z.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 13,
                  paddingHorizontal: 6,
                  borderBottomWidth: StyleSheet.hairlineWidth * 2,
                  borderColor: t.line,
                  backgroundColor: pressed ? t.bgAlt : 'transparent',
                })}
              >
                <Txt v="body" color={z.id ? t.ink : t.muted} style={{ flex: 1 }}>
                  {tr(z.label)}
                </Txt>
                {active ? <Feather name="check" size={17} color={t.accent} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}

export { HolidayBadge } from './HolidayBadge';
