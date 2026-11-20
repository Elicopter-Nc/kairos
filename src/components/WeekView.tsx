import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Occurrence } from '../data/recurrence';
import { addDays, DAYS_MIN, fromKey, timeToMinutes, todayKey } from '../lib/date';
import { asDeviceOccurrence } from '../lib/deviceCalendar';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { tap, Txt } from './ui';

const START_H = 6;
const END_H = 24;
const HOUR = 44; // hauteur d'une heure en dp
const GUTTER = 30;

interface Placed {
  occ: Occurrence;
  top: number;
  height: number;
  col: number;
  cols: number;
}

/** Répartit les événements qui se chevauchent dans des colonnes partagées. */
function layoutDay(list: Occurrence[]): Placed[] {
  const items = list
    .map((occ) => {
      const s = Math.max(START_H * 60, timeToMinutes(occ.event.start ?? '00:00'));
      const rawEnd = occ.event.end ? timeToMinutes(occ.event.end) : s + 60;
      const e = Math.min(END_H * 60, Math.max(rawEnd, s + 25));
      return { occ, s, e };
    })
    .sort((a, b) => a.s - b.s || b.e - a.e);

  const out: Placed[] = [];
  let cluster: { occ: Occurrence; s: number; e: number; col: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) {
      out.push({ occ: c.occ, top: ((c.s - START_H * 60) / 60) * HOUR, height: Math.max(20, ((c.e - c.s) / 60) * HOUR - 2), col: c.col, cols });
    }
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush();
    const used = new Set(cluster.filter((c) => c.e > it.s).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...it, col });
    clusterEnd = Math.max(clusterEnd, it.e);
    if (cluster.length === 1) clusterEnd = it.e;
  }
  if (cluster.length) flush();
  return out;
}

export function WeekView({
  weekStart,
  occurrences,
  onPressEvent,
  onPressSlot,
  holidayOn,
  vacationOn,
}: {
  weekStart: string; // lundi
  occurrences: Occurrence[];
  holidayOn?: (date: string) => string | undefined;
  vacationOn?: (date: string) => string | undefined;
  onPressEvent: (o: Occurrence) => void;
  onPressSlot: (date: string, time: string) => void;
}) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const colW = (width - 40 - GUTTER) / 7;

  // l'heure courante, rafraîchie chaque minute pour le trait « maintenant »
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  useEffect(() => {
    const i = setInterval(() => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()), 60000);
    return () => clearInterval(i);
  }, []);

  const byDay = days.map((d) => occurrences.filter((o) => o.date === d));
  const allDay = byDay.map((l) => l.filter((o) => o.event.allDay));
  const timed = byDay.map((l) => layoutDay(l.filter((o) => !o.event.allDay)));
  const maxAllDay = Math.min(3, Math.max(0, ...allDay.map((l) => l.length)));

  const colorOf = (o: Occurrence) => asDeviceOccurrence(o)?.device.color ?? t.swatch(o.event.color);
  const fgOf = (o: Occurrence) => (asDeviceOccurrence(o) ? t.ink : t.onSwatch(o.event.color));

  return (
    <View>
      {/* ── En-tête des jours ── */}
      <View style={{ flexDirection: 'row', paddingLeft: GUTTER, marginBottom: 6 }}>
        {days.map((d, i) => {
          const isToday = d === today;
          const ferie = holidayOn?.(d);
          const vac = vacationOn?.(d);
          return (
            <View key={d} style={{ width: colW, alignItems: 'center', gap: 3 }} accessibilityLabel={[ferie && tr('Férié : {name}', { name: ferie }), vac].filter(Boolean).join(', ') || undefined}>
              <Txt v="kicker" color={i >= 5 ? t.accent : t.muted} style={{ fontSize: 9.5, letterSpacing: 1 }}>
                {DAYS_MIN[i]}
              </Txt>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? t.accent : 'transparent' }}>
                <Txt v="num" color={isToday ? t.onAccent : ferie ? t.kaki : t.ink} style={{ fontSize: 14 }}>
                  {fromKey(d).getDate()}
                </Txt>
              </View>
              <View style={{ height: 4, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                {vac ? <View style={{ position: 'absolute', left: 0, right: 0, height: 4, backgroundColor: t.accentSoft, opacity: 0.7 }} /> : null}
                {ferie ? <View style={{ width: 5, height: 5, transform: [{ rotate: '45deg' }], backgroundColor: t.kaki }} /> : null}
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Journée entière ── */}
      {maxAllDay > 0 ? (
        <View style={{ flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, paddingVertical: 4 }}>
          <View style={{ width: GUTTER, justifyContent: 'center' }}>
            <Txt v="jp" color={t.muted} style={{ fontSize: 9, letterSpacing: 0 }}>
              終日
            </Txt>
          </View>
          {allDay.map((list, i) => (
            <View key={days[i]} style={{ width: colW, paddingHorizontal: 1, gap: 2 }}>
              {list.slice(0, 2).map((o) => (
                <Pressable
                  key={o.event.id + o.date}
                  onPress={() => {
                    tap();
                    onPressEvent(o);
                  }}
                  accessibilityLabel={tr('{title}, toute la journée', { title: o.event.title })}
                  style={{ backgroundColor: colorOf(o), borderRadius: 5, paddingHorizontal: 3, paddingVertical: 2 }}
                >
                  <Txt v="small" color={fgOf(o)} numberOfLines={1} style={{ fontSize: 9.5, lineHeight: 12 }}>
                    {o.event.title}
                  </Txt>
                </Pressable>
              ))}
              {list.length > 2 ? (
                <Txt v="small" color={t.muted} style={{ fontSize: 9, textAlign: 'center' }}>
                  +{list.length - 2}
                </Txt>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* ── Grille horaire ── */}
      <View style={{ flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line }}>
        <View style={{ width: GUTTER }}>
          {Array.from({ length: END_H - START_H }, (_, h) => (
            <View key={h} style={{ height: HOUR }}>
              <Txt v="num" color={t.muted} style={{ fontSize: 9.5, marginTop: -6 }}>
                {h === 0 ? '' : tr('{h}h', { h: START_H + h })}
              </Txt>
            </View>
          ))}
        </View>
        {days.map((d, i) => (
          <Pressable
            key={d}
            accessibilityLabel={tr('Créer un événement le {date}', { date: d })}
            onPress={(e) => {
              const y = e.nativeEvent.locationY;
              const mins = START_H * 60 + Math.floor(((y / HOUR) * 60) / 30) * 30;
              const h = Math.min(23, Math.floor(mins / 60));
              tap();
              onPressSlot(d, `${String(h).padStart(2, '0')}:${mins % 60 === 30 ? '30' : '00'}`);
            }}
            style={{
              width: colW,
              height: (END_H - START_H) * HOUR,
              borderLeftWidth: StyleSheet.hairlineWidth * 2,
              borderColor: t.line,
              backgroundColor: d === today ? t.bgAlt : 'transparent',
            }}
          >
            {/* lignes des heures */}
            {Array.from({ length: END_H - START_H }, (_, h) => (
              <View key={h} pointerEvents="none" style={{ position: 'absolute', top: h * HOUR, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: t.line, opacity: h === 0 ? 0 : 0.7 }} />
            ))}
            {/* événements */}
            {timed[i].map((p) => {
              const w = colW / p.cols;
              return (
                <Pressable
                  key={p.occ.event.id + p.occ.date}
                  onPress={() => {
                    tap();
                    onPressEvent(p.occ);
                  }}
                  accessibilityLabel={p.occ.event.end ? tr('{title}, {start} à {end}', { title: p.occ.event.title, start: p.occ.event.start ?? '', end: p.occ.event.end }) : `${p.occ.event.title}, ${p.occ.event.start}`}
                  style={{
                    position: 'absolute',
                    top: p.top + 1,
                    height: p.height,
                    left: p.col * w + 1,
                    width: w - 2,
                    backgroundColor: colorOf(p.occ),
                    borderRadius: 6,
                    paddingHorizontal: 3,
                    paddingVertical: 2,
                    overflow: 'hidden',
                  }}
                >
                  <Txt v="small" color={fgOf(p.occ)} numberOfLines={p.height > 40 ? 3 : 1} style={{ fontSize: 9.5, lineHeight: 12 }}>
                    {p.occ.event.title}
                  </Txt>
                  {p.height > 34 && w > 30 ? (
                    <Txt v="num" color={fgOf(p.occ)} style={{ fontSize: 8.5, opacity: 0.75 }}>
                      {p.occ.event.start}
                    </Txt>
                  ) : null}
                </Pressable>
              );
            })}
            {/* trait « maintenant » */}
            {d === today && nowMin >= START_H * 60 ? (
              <View pointerEvents="none" style={{ position: 'absolute', left: -3, right: 0, top: ((nowMin - START_H * 60) / 60) * HOUR - 1, flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.kaki }} />
                <View style={{ flex: 1, height: 1.5, backgroundColor: t.kaki }} />
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
