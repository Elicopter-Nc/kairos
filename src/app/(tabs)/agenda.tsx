import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, View } from 'react-native';
import { DeviceEventItem } from '../../components/DeviceEventItem';
import { EventItem, TaskItem } from '../../components/items';
import { Card, Chip, Empty, Fab, IconBtn, Screen, Section, tap, Txt } from '../../components/ui';
import { eventsBetween, Occurrence } from '../../data/recurrence';
import { WeekView } from '../../components/WeekView';
import { useStore } from '../../data/store';
import { addDays, capitalize, DAYS_MIN, formatLong, formatShort, fromKey, MONTHS, monthGrid, relativeLabel, todayKey, weekKeys } from '../../lib/date';
import { asDeviceOccurrence, openDeviceEvent, useDeviceEvents } from '../../lib/deviceCalendar';
import { useHolidays } from '../../lib/holidays';
import { tr, trn } from '../../i18n';
import { KANJI_MONTHS, useTheme } from '../../theme';

function sortOcc(list: Occurrence[]): Occurrence[] {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
    return (a.event.start ?? '') < (b.event.start ?? '') ? -1 : 1;
  });
}

/** Affiche une occurrence Kairos (éditable) ou du téléphone (lecture seule). */
function OccItem({ o, showDate }: { o: Occurrence; showDate?: boolean }) {
  const dev = asDeviceOccurrence(o);
  return dev ? <DeviceEventItem occ={dev} showDate={showDate} /> : <EventItem occ={o} showDate={showDate} />;
}

export default function Agenda() {
  const t = useTheme();
  const { db } = useStore();
  const today = todayKey();
  const [selected, setSelected] = useState(today);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [view, setView] = useState<'mois' | 'semaine' | 'liste'>('mois');
  const [weekStart, setWeekStart] = useState(() => weekKeys(todayKey())[0]);
  const hol = useHolidays();

  const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  // événements Kairos + calendriers du téléphone (lecture seule)
  const deviceMonth = useDeviceEvents(grid[0], grid[41]);
  const deviceWeek = useDeviceEvents(weekStart, addDays(weekStart, 6));
  const deviceUpcoming = useDeviceEvents(today, addDays(today, 60));
  const occ = useMemo(() => sortOcc([...eventsBetween(db.events, grid[0], grid[41]), ...deviceMonth]), [db.events, grid, deviceMonth]);
  const weekOcc = useMemo(
    () => sortOcc([...eventsBetween(db.events, weekStart, addDays(weekStart, 6)), ...deviceWeek]),
    [db.events, weekStart, deviceWeek],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const o of occ) m.set(o.date, [...(m.get(o.date) ?? []), asDeviceOccurrence(o)?.device.color ?? t.swatch(o.event.color)]);
    return m;
  }, [occ, t]);
  const tasksByDay = useMemo(() => new Set(db.tasks.filter((x) => !x.done && x.due).map((x) => x.due as string)), [db.tasks]);

  const dayEvents = occ.filter((o) => o.date === selected);
  const dayTasks = db.tasks.filter((x) => x.due === selected);
  const upcoming = useMemo(() => sortOcc([...eventsBetween(db.events, today, addDays(today, 60)), ...deviceUpcoming]), [db.events, today, deviceUpcoming]);
  const upcomingHolidays = useMemo(() => {
    const end = addDays(today, 60);
    return [...hol.feries.keys()].filter((k) => k >= today && k <= end).sort();
  }, [hol.feries, today]);

  const move = (n: number) => {
    tap();
    setCursor(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const goToday = () => {
    const d = new Date();
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(today);
    setWeekStart(weekKeys(today)[0]);
  };
  const moveWeek = (n: number) => {
    tap();
    setWeekStart((w) => addDays(w, n * 7));
  };
  const openOcc = (o: Occurrence) => {
    const dev = asDeviceOccurrence(o);
    if (dev) openDeviceEvent(dev);
    else router.push({ pathname: '/event/[id]', params: { id: o.event.id, date: o.date } });
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen komorebi komorebiHeight={260}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 }}>
          <Txt v="jp" color={t.accent} style={{ flex: 1 }}>
            暦 · {cursor.y}
          </Txt>
          <Chip label={tr('Mois')} active={view === 'mois'} onPress={() => setView('mois')} />
          <Chip label={tr('Semaine')} active={view === 'semaine'} onPress={() => setView('semaine')} />
          <Chip label={tr('À venir')} active={view === 'liste'} onPress={() => setView('liste')} />
        </View>

        {view === 'mois' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 12, marginBottom: 16 }}>
              <Pressable onPress={goToday} style={{ flex: 1 }} accessibilityLabel={tr('Revenir à aujourd\'hui')}>
                <Txt v="display">{capitalize(MONTHS[cursor.m])}</Txt>
                <Txt v="jp" color={t.muted}>
                  {KANJI_MONTHS[cursor.m]}
                </Txt>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 6 }}>
                <IconBtn icon="chevron-left" label={tr('Mois précédent')} onPress={() => move(-1)} />
                <IconBtn icon="chevron-right" label={tr('Mois suivant')} onPress={() => move(1)} />
              </View>
            </View>

            <Card radius={22} contentStyle={{ paddingVertical: 10, paddingHorizontal: 6 }}>
              <View style={{ flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, paddingBottom: 6, marginBottom: 4 }}>
                {DAYS_MIN.map((d, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                    <Txt v="kicker" color={i >= 5 ? t.accent : t.muted} style={{ fontSize: 10, letterSpacing: 1 }}>
                      {d}
                    </Txt>
                  </View>
                ))}
              </View>
              {Array.from({ length: 6 }, (_, w) => (
                <View key={w} style={{ flexDirection: 'row' }}>
                  {grid.slice(w * 7, w * 7 + 7).map((key, col) => {
                    const inMonth = fromKey(key).getMonth() === cursor.m;
                    const isSel = key === selected;
                    const isToday = key === today;
                    const dots = byDay.get(key) ?? [];
                    const ferie = hol.holidayOn(key);
                    const vac = hol.vacationOn(key);
                    const vacStart = vac && (key === vac.start || col === 0);
                    const vacEnd = vac && (key === vac.end || col === 6);
                    return (
                      <Pressable
                        key={key}
                        onPress={() => {
                          tap();
                          setSelected(key);
                          if (!inMonth) {
                            const d = fromKey(key);
                            setCursor({ y: d.getFullYear(), m: d.getMonth() });
                          }
                        }}
                        onLongPress={() => router.push({ pathname: '/event/[id]', params: { id: 'new', date: key } })}
                        accessibilityLabel={`${formatLong(key)}${ferie ? `, ${tr('férié : {name}', { name: ferie })}` : ''}${vac ? `, ${vac.name}` : ''}, ${trn(dots.length, '{n} événement', '{n} événements')}`}
                        style={{ flex: 1, alignItems: 'center', paddingVertical: 3 }}
                      >
                        {vac ? (
                          <View
                            pointerEvents="none"
                            style={{
                              position: 'absolute',
                              top: 6,
                              bottom: 6,
                              left: vacStart ? 4 : 0,
                              right: vacEnd ? 4 : 0,
                              backgroundColor: t.accentSoft,
                              opacity: t.dark ? 0.55 : 0.5,
                              borderTopLeftRadius: vacStart ? 19 : 0,
                              borderBottomLeftRadius: vacStart ? 19 : 0,
                              borderTopRightRadius: vacEnd ? 19 : 0,
                              borderBottomRightRadius: vacEnd ? 19 : 0,
                            }}
                          />
                        ) : null}
                        <View
                          style={{
                            width: 38,
                            height: 44,
                            borderRadius: 19,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isSel ? t.accent : 'transparent',
                            borderWidth: isToday && !isSel ? 1.2 : 0,
                            borderColor: t.accent,
                          }}
                        >
                          <Txt v="num" color={isSel ? t.onAccent : ferie ? t.kaki : inMonth ? t.ink : t.muted} style={{ fontSize: 15, opacity: inMonth ? 1 : 0.45 }}>
                            {fromKey(key).getDate()}
                          </Txt>
                          <View style={{ flexDirection: 'row', gap: 2, marginTop: 2, height: 5 }}>
                            {ferie ? <View style={{ width: 5, height: 5, transform: [{ rotate: '45deg' }], backgroundColor: isSel ? t.onAccent : t.kaki }} /> : null}
                            {dots.slice(0, 3).map((c, i) => (
                              <View key={i} style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: isSel ? t.onAccent : c }} />
                            ))}
                            {tasksByDay.has(key) ? <View style={{ width: 5, height: 5, borderRadius: 1, borderWidth: 1, borderColor: isSel ? t.onAccent : t.muted }} /> : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </Card>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: t.muted }} />
              <Txt v="small" color={t.muted}>{tr('événement')}</Txt>
              <View style={{ width: 5, height: 5, borderRadius: 1, borderWidth: 1, borderColor: t.muted, marginLeft: 6 }} />
              <Txt v="small" color={t.muted}>{tr('tâche · appui long sur un jour pour créer')}</Txt>
            </View>
            {hol.feries.size || hol.vacances.length ? (
              <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                {hol.feries.size ? (
                  <>
                    <View style={{ width: 5, height: 5, transform: [{ rotate: '45deg' }], backgroundColor: t.kaki }} />
                    <Txt v="small" color={t.muted}>
                      {tr('jour férié')}
                    </Txt>
                  </>
                ) : null}
                {hol.vacances.length ? (
                  <>
                    <View style={{ width: 14, height: 6, borderRadius: 3, backgroundColor: t.accentSoft, marginLeft: 6 }} />
                    <Txt v="small" color={t.muted}>
                      {tr('vacances scolaires')}
                    </Txt>
                  </>
                ) : null}
              </View>
            ) : null}

            <Section title={selected === today ? tr("Aujourd'hui") : capitalize(formatLong(selected))}>
              <DayMarks ferie={hol.holidayOn(selected)} vacation={hol.vacationOn(selected)?.name} />
              {dayEvents.length === 0 && dayTasks.length === 0 ? <Empty jp="白" title={tr('Page blanche.')} hint={tr('Touche + pour ajouter un événement ce jour-là.')} /> : null}
              {dayEvents.map((o) => (
                <OccItem key={o.event.id + o.date} o={o} />
              ))}
              {dayTasks.length ? (
                <View style={{ marginTop: dayEvents.length ? 10 : 0 }}>
                  <Txt v="kicker" color={t.muted} style={{ marginBottom: 8 }}>
                    {tr('Tâches à échéance')}
                  </Txt>
                  {dayTasks.map((x) => (
                    <TaskItem key={x.id} task={x} compact />
                  ))}
                </View>
              ) : null}
            </Section>
          </>
        ) : view === 'semaine' ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 12, marginBottom: 16 }}>
              <Pressable onPress={goToday} style={{ flex: 1 }} accessibilityLabel={tr('Revenir à cette semaine')}>
                <Txt v="display" style={{ fontSize: 38, lineHeight: 46 }}>
                  {tr('Semaine')}
                </Txt>
                <Txt v="small" color={t.muted}>
                  {formatShort(weekStart)} → {formatShort(addDays(weekStart, 6))}
                </Txt>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 6 }}>
                <IconBtn icon="chevron-left" label={tr('Semaine précédente')} onPress={() => moveWeek(-1)} />
                <IconBtn icon="chevron-right" label={tr('Semaine suivante')} onPress={() => moveWeek(1)} />
              </View>
            </View>
            <WeekView
              weekStart={weekStart}
              occurrences={weekOcc}
              holidayOn={hol.holidayOn}
              vacationOn={(k) => hol.vacationOn(k)?.name}
              onPressEvent={openOcc}
              onPressSlot={(date, start) => router.push({ pathname: '/event/[id]', params: { id: 'new', date, start } })}
            />
            <Txt v="small" color={t.muted} style={{ marginTop: 10, textAlign: 'center' }}>
              {tr('Touche un créneau vide pour créer un événement à cette heure')}
            </Txt>
          </>
        ) : (
          <>
            <Txt v="display" style={{ marginTop: 12, marginBottom: 6 }}>
              {tr('À venir')}
            </Txt>
            {upcoming.length === 0 && upcomingHolidays.length === 0 ? (
              <Empty jp="空" title={tr('Horizon dégagé.')} hint={tr('Aucun événement dans les 60 prochains jours.')} />
            ) : (
              withHolidays(groupByDay(upcoming), upcomingHolidays).map(([day, list]) => (
                <View key={day} style={{ marginTop: 18 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                    <Txt v="h2">{relativeLabel(day)}</Txt>
                    <Txt v="small" color={t.muted}>
                      {formatLong(day)}
                    </Txt>
                  </View>
                  <DayMarks ferie={hol.holidayOn(day)} />
                  {list.map((o) => (
                    <OccItem key={o.event.id + o.date} o={o} />
                  ))}
                </View>
              ))
            )}
          </>
        )}
      </Screen>
      <Fab label={tr('Nouvel événement')} onPress={() => router.push({ pathname: '/event/[id]', params: { id: 'new', date: selected } })} />
    </View>
  );
}

function groupByDay<T extends { date: string }>(list: T[]): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const o of list) m.set(o.date, [...(m.get(o.date) ?? []), o]);
  return [...m.entries()];
}

/** Ajoute les jours fériés sans événement dans la liste « À venir », dans l'ordre. */
function withHolidays<T>(groups: [string, T[]][], days: string[]): [string, T[]][] {
  const have = new Set(groups.map(([d]) => d));
  const all: [string, T[]][] = [...groups, ...days.filter((d) => !have.has(d)).map((d) => [d, []] as [string, T[]])];
  return all.sort((a, b) => a[0].localeCompare(b[0]));
}

/** Lignes « Jour férié : … » / « Vacances de … » en tête d'une journée. */
function DayMarks({ ferie, vacation }: { ferie?: string; vacation?: string }) {
  const t = useTheme();
  if (!ferie && !vacation) return null;
  return (
    <View style={{ gap: 4, marginBottom: 10 }}>
      {ferie ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Feather name="flag" size={12} color={t.kaki} />
          <Txt v="small" color={t.kaki}>
            {tr('Jour férié : {name}', { name: ferie })}
          </Txt>
        </View>
      ) : null}
      {vacation ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Feather name="sun" size={12} color={t.accent} />
          <Txt v="small" color={t.inkSoft}>
            {vacation}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
