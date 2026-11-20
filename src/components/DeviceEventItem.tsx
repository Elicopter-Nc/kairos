import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';
import { DeviceOccurrence, openDeviceEvent } from '../lib/deviceCalendar';
import { relativeLabel } from '../lib/date';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { Card, Txt } from './ui';

/** Événement venant d'un calendrier du téléphone : lecture seule, s'ouvre dans l'appli calendrier. */
export function DeviceEventItem({ occ, showDate }: { occ: DeviceOccurrence; showDate?: boolean }) {
  const t = useTheme();
  const { event, date, device } = occ;
  return (
    <Card
      style={{ marginBottom: 8 }}
      onPress={() => openDeviceEvent(occ)}
      accessibilityLabel={tr('{title}, calendrier du téléphone {cal}', { title: event.title, cal: device.calendarTitle })}
      contentStyle={{ flexDirection: 'row', alignItems: 'stretch', paddingVertical: 12, paddingHorizontal: 14, gap: 12 }}
    >
      <View style={{ width: 46, justifyContent: 'center' }}>
        {event.allDay ? (
          <Txt v="jp" color={t.accent} style={{ fontSize: 12, letterSpacing: 1 }}>
            終日
          </Txt>
        ) : (
          <>
            <Txt v="num" color={t.accent} style={{ fontSize: 16 }}>
              {event.start}
            </Txt>
            {event.end ? (
              <Txt v="num" color={t.muted} style={{ fontSize: 12 }}>
                {event.end}
              </Txt>
            ) : null}
          </>
        )}
      </View>
      <View style={{ width: 3, borderRadius: 2, backgroundColor: device.color }} />
      <View style={{ flex: 1, gap: 2, justifyContent: 'center' }}>
        {showDate ? (
          <Txt v="kicker" color={t.muted} style={{ fontSize: 9.5 }}>
            {relativeLabel(date)}
          </Txt>
        ) : null}
        <Txt v="body" numberOfLines={2}>
          {event.title}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Feather name="smartphone" size={11} color={t.muted} />
            <Txt v="small" color={t.muted} numberOfLines={1} style={{ fontSize: 12, maxWidth: 160 }}>
              {device.calendarTitle}
            </Txt>
          </View>
          {event.location ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="map-pin" size={11} color={t.muted} />
              <Txt v="small" color={t.muted} numberOfLines={1} style={{ fontSize: 12, maxWidth: 140 }}>
                {event.location}
              </Txt>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
