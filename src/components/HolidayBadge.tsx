import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';
import { formatShort, todayKey } from '../lib/date';
import { nextHoliday, useHolidays } from '../lib/holidays';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { Txt } from './ui';

/**
 * Ligne discrète pour l'écran Jour :
 * « Jour férié : Armistice », « Vacances de Noël · jusqu’au dim. 3 janv. »,
 * sinon « Prochain férié : Noël dans 5 j » (sous 14 jours). Rien sinon.
 */
export function HolidayBadge({ date }: { date?: string }) {
  const t = useTheme();
  const { feries, holidayOn, vacationOn } = useHolidays();
  const day = date ?? todayKey();
  const ferie = holidayOn(day);
  const vac = vacationOn(day);
  const next = !ferie ? nextHoliday(feries, day, 14) : null;

  const lines: { icon: 'flag' | 'sun' | 'calendar'; text: string; strong?: boolean }[] = [];
  if (ferie) lines.push({ icon: 'flag', text: tr('Jour férié : {name}', { name: ferie }), strong: true });
  if (vac) lines.push({ icon: 'sun', text: vac.end > day ? tr('{name} · jusqu’au {date}', { name: vac.name, date: formatShort(vac.end) }) : tr('{name} · dernier jour', { name: vac.name }) });
  if (next) lines.push({ icon: 'calendar', text: next.inDays === 1 ? tr('Prochain férié : {name} demain', { name: next.name }) : tr('Prochain férié : {name} dans {n} j', { name: next.name, n: next.inDays }) });
  if (!lines.length) return null;

  return (
    <View style={{ gap: 4 }}>
      {lines.map((l) => (
        <View key={l.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Feather name={l.icon} size={12} color={l.strong ? t.kaki : t.accent} />
          <Txt v="small" color={l.strong ? t.kaki : t.inkSoft}>
            {l.text}
          </Txt>
        </View>
      ))}
    </View>
  );
}
