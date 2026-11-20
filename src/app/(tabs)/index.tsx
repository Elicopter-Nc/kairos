import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Enso } from '../../components/Enso';
import { DeviceEventItem } from '../../components/DeviceEventItem';
import { HolidayBadge } from '../../components/HolidayBadge';
import { JournalCard } from '../../components/JournalCard';
import { EventItem } from '../../components/items';
import { TaskItem } from '../../components/TaskItem';
import { UpdateBanner } from '../../components/UpdateBanner';
import { WeatherCard } from '../../components/WeatherCard';
import { Card, Chip, Empty, IconBtn, Screen, Section, success, tap, Txt, Vertical } from '../../components/ui';
import { eventsBetween, eventsOn, Occurrence } from '../../data/recurrence';
import { newId, useStore } from '../../data/store';
import { asDeviceOccurrence, useDeviceEvents } from '../../lib/deviceCalendar';
import { addDays, capitalize, formatShort, fromKey, greeting, MONTHS, timeToMinutes, todayKey } from '../../lib/date';
import { parseQuick } from '../../lib/parse';
import { currentMicroSeason } from '../../lib/seasons';
import { useWeather } from '../../lib/weather';
import { dayProgress, isoWeek, streak, thoughtOfDay } from '../../lib/stats';
import { tr } from '../../i18n';
import { KANJI_DAYS, useTheme } from '../../theme';

// horodatage hors du composant (appelé uniquement depuis un gestionnaire d'événement)
const stamp = () => Date.now();

function OccItem({ o, showDate }: { o: Occurrence; showDate?: boolean }) {
  const dev = asDeviceOccurrence(o);
  return dev ? <DeviceEventItem occ={dev} showDate={showDate} /> : <EventItem occ={o} showDate={showDate} />;
}

const byTime = (a: Occurrence, b: Occurrence) =>
  a.date.localeCompare(b.date) || Number(b.event.allDay) - Number(a.event.allDay) || (a.event.start ?? '').localeCompare(b.event.start ?? '');

export default function Today() {
  const t = useTheme();
  const { db, upsertTask, upsertNote, upsertEvent, toggleHabit, updateSettings } = useStore();
  const [capture, setCapture] = useState('');
  const [mode, setMode] = useState<'task' | 'note'>('task');
  const [kindOverride, setKindOverride] = useState<'task' | 'event' | null>(null);
  const today = todayKey();
  const d = fromKey(today);

  const device = useDeviceEvents(today, addDays(today, 7));
  const events = [...eventsOn(db.events, today), ...device.filter((o) => o.date === today)].sort(byTime);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const upcoming = [...eventsBetween(db.events, addDays(today, 1), addDays(today, 7)), ...device.filter((o) => o.date > today)].sort(byTime).slice(0, 3);
  const kou = currentMicroSeason(new Date(), db.settings.hemisphere);
  const weather = useWeather(db.settings.weather);

  // hémisphère déduit de la position météo (pour les saisons et les particules)
  const lat = weather.data?.lat;
  useEffect(() => {
    if (lat === undefined) return;
    const h = lat < 0 ? 'sud' : 'nord';
    if (h !== db.settings.hemisphere) updateSettings({ hemisphere: h });
  }, [lat, db.settings.hemisphere, updateSettings]);

  // saisie naturelle : « dentiste demain 14h30 », « sport tous les lundis 7h #perso »
  const parsed = mode === 'task' && capture.trim() ? parseQuick(capture, new Date(), db.settings.lists) : null;
  const kind = kindOverride ?? parsed?.kind ?? 'task';
  const startOfToday = d.getTime();
  const tasks = db.tasks
    .filter((x) => x.due && x.due <= today && (!x.done || (x.doneAt ?? 0) > startOfToday))
    .sort((a, b) => Number(a.done) - Number(b.done) || b.priority - a.priority || (a.time ?? '99').localeCompare(b.time ?? '99'));
  const remaining = tasks.filter((x) => !x.done).length;
  const focusToday = db.focus.filter((f) => f.date === today).reduce((s, f) => s + f.minutes, 0);
  const progress = dayProgress();
  const nextEvent = events.find((o) => !o.event.allDay && timeToMinutes(o.event.start ?? '00:00') >= nowMin);

  const submit = () => {
    const text = capture.trim();
    if (!text) return;
    if (mode === 'note') {
      upsertNote({ id: newId(), title: '', body: text, color: 'citron', pinned: false, createdAt: stamp(), updatedAt: stamp() });
    } else {
      const p = parseQuick(text, new Date(), db.settings.lists);
      if (kind === 'event') {
        upsertEvent({
          id: newId(),
          title: p.title,
          date: p.date ?? today,
          allDay: !p.start,
          start: p.start,
          end: p.end ?? (p.start ? plusHour(p.start) : undefined),
          location: p.location,
          color: 'citron',
          reminder: p.start ? 15 : null,
          recurrence: p.recurrence,
          createdAt: stamp(),
        });
      } else {
        upsertTask({
          id: newId(),
          title: p.title,
          done: false,
          due: p.date ?? today,
          time: p.start,
          remind: !!p.start,
          priority: p.priority,
          list: p.list ?? db.settings.lists[0] ?? 'Perso',
          subtasks: [],
          createdAt: stamp(),
        });
      }
    }
    success();
    setCapture('');
    setKindOverride(null);
  };

  return (
    <Screen komorebi komorebiHeight={430}>
      {/* ── En-tête : date, enso de la journée, jour en kanji ── */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 18 }}>
        <View style={{ flex: 1 }}>
          <Txt style={{ fontFamily: t.font.mincho, fontSize: 92, lineHeight: 100, letterSpacing: -2 }}>{d.getDate()}</Txt>
          <Txt v="kicker" color={t.inkSoft} style={{ letterSpacing: 4, marginTop: -2 }}>
            {MONTHS[d.getMonth()]} · {tr('semaine {n}', { n: isoWeek(d) })}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingTop: 14 }}>
          <Pressable onPress={() => router.push('/focus')} accessibilityLabel={tr('Journée écoulée à {p} %. Ouvrir le mode Focus', { p: Math.round(progress * 100) })}>
            <Enso size={70} progress={progress}>
              <Txt v="num" style={{ fontSize: 15, lineHeight: 18 }}>
                {Math.round(progress * 100)}
                <Txt v="small" color={t.muted} style={{ fontSize: 10 }}>
                  %
                </Txt>
              </Txt>
              <Txt v="small" color={t.muted} style={{ fontSize: 8.5, lineHeight: 10 }}>
                {tr('journée')}
              </Txt>
            </Enso>
          </Pressable>
          <Vertical text={`${KANJI_DAYS[d.getDay()]}曜日`} size={16} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <View style={{ flex: 1 }}>
          <Txt v="jp" color={t.accent} style={{ fontSize: 15 }}>
            {kou.season.jp}
          </Txt>
          <Txt v="small" color={t.inkSoft}>
            {tr(kou.season.fr)} · {kou.kindLabel.toLowerCase()}
          </Txt>
        </View>
        <IconBtn icon="search" label={tr('Rechercher partout')} onPress={() => router.push('/search')} size={38} />
      </View>
      <View style={{ marginTop: 8 }}>
        <HolidayBadge />
      </View>
      <View style={{ marginTop: 14 }}>
        <UpdateBanner />
      </View>

      <Txt v="title" style={{ marginTop: 18 }}>
        {greeting()}
        {db.settings.name ? `, ${db.settings.name}` : ''}.
      </Txt>
      <Txt v="body" color={t.inkSoft}>
        {nextEvent
          ? tr('Prochain rendez-vous à {time} : {title}.', { time: nextEvent.event.start ?? '', title: nextEvent.event.title })
          : events.length
            ? tr('Plus aucun rendez-vous aujourd’hui.')
            : tr('Aucun rendez-vous, la journée est à toi.')}
      </Txt>

      <WeatherCard />

      {/* ── Capture rapide ── */}
      <Card style={{ marginTop: 20 }} radius={999} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 6, paddingVertical: 5 }}>
        <Pressable
          onPress={() => {
            tap();
            setMode(mode === 'task' ? 'note' : 'task');
          }}
          accessibilityLabel={mode === 'task' ? tr('Mode tâche, toucher pour passer en note') : tr('Mode note, toucher pour passer en tâche')}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name={mode === 'task' ? 'check-square' : 'feather'} size={16} color={t.ink} />
        </Pressable>
        <TextInput
          value={capture}
          onChangeText={setCapture}
          onSubmitEditing={submit}
          returnKeyType="done"
          placeholder={mode === 'task' ? tr('Ex : {exemple}', { exemple: 'dentiste demain 14h30' }) : tr('Une idée à noter…')}
          placeholderTextColor={t.muted}
          selectionColor={t.selection}
          cursorColor={t.accent}
          selectionHandleColor={t.accent}
          style={{ flex: 1, fontFamily: t.font.regular, fontSize: 15, color: t.ink, paddingVertical: 8 }}
        />
        <Pressable
          onPress={submit}
          accessibilityLabel={tr('Ajouter')}
          style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}
        >
          <Feather name="arrow-up" size={18} color={t.onAccent} />
        </Pressable>
      </Card>

      {parsed && (parsed.found.length || kindOverride) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingHorizontal: 4 }}>
          <Chip label={kind === 'event' ? tr('Événement') : tr('Tâche')} icon={kind === 'event' ? 'calendar' : 'check-square'} active onPress={() => setKindOverride(kind === 'event' ? 'task' : 'event')} />
          <Txt v="small" color={t.inkSoft} style={{ flex: 1 }}>
            {[parsed.title, parsed.date ? formatShort(parsed.date) : null, parsed.start ? parsed.start + (parsed.end ? '–' + parsed.end : '') : null, ...parsed.found.filter((f) => /^(chaque|#|@|urgent|prioritaire)/.test(f))]
              .filter(Boolean)
              .join(' · ')}
          </Txt>
        </View>
      ) : null}

      {/* ── Bento ── */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Tile n={remaining} label={tr('à faire')} jp="やること" bg={t.accentSoft} onPress={() => router.navigate('/taches')} />
        <Tile n={events.length} label={tr('rendez-vous')} jp="予定" onPress={() => router.navigate('/agenda')} />
        <Tile n={focusToday} label={tr('min focus')} jp="集中" onPress={() => router.push('/focus')} />
      </View>

      {/* ── Agenda du jour ── */}
      <Section jp="予定" title={tr('Programme')} right={<Chip label={tr('Ajouter')} icon="plus" onPress={() => router.push({ pathname: '/event/[id]', params: { id: 'new', date: today } })} />}>
        {events.length ? (
          events.map((o) => <OccItem key={o.event.id + o.date} o={o} />)
        ) : (
          <Txt v="body" color={t.muted} style={{ marginBottom: 8 }}>
            {tr('Rien au calendrier aujourd’hui.')}
          </Txt>
        )}
        {upcoming.length ? (
          <View style={{ marginTop: 10 }}>
            <Txt v="kicker" color={t.muted} style={{ marginBottom: 8 }}>
              {tr('Cette semaine')}
            </Txt>
            {upcoming.map((o) => (
              <OccItem key={o.event.id + o.date} o={o} showDate />
            ))}
          </View>
        ) : null}
      </Section>

      {/* ── Tâches ── */}
      <Section jp="やること" title={tr('Aujourd’hui · {n}', { n: remaining })} right={<Chip label={tr('Tout voir')} onPress={() => router.navigate('/taches')} />}>
        {tasks.length ? tasks.map((task) => <TaskItem key={task.id} task={task} compact />) : <Empty jp="空" title={tr('Table rase.')} hint={tr('Aucune tâche prévue aujourd’hui. Ajoute-en une juste au-dessus.')} />}
      </Section>

      {/* ── Rituels ── */}
      <Section jp="習慣" title={tr('Rituels')} right={<Chip label={tr('Gérer')} onPress={() => router.push('/habits')} />}>
        {db.habits.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {db.habits.map((h) => {
              const done = h.log.includes(today);
              const s = streak(h);
              return (
                <Pressable
                  key={h.id}
                  onPress={() => {
                    if (!done) success();
                    else tap();
                    toggleHabit(h.id, today);
                  }}
                  accessibilityLabel={`${h.name}, ${done ? tr('fait') : tr('à faire')}`}
                  style={{ alignItems: 'center', width: 66 }}
                >
                  <Enso size={60} progress={done ? 1 : 0} stroke={done ? 4 : 1.5} color={done ? t.accent : t.line} fill={done ? t.swatch(h.color) : undefined}>
                    <Text style={{ fontSize: 22, lineHeight: 28, textAlign: 'center', includeFontPadding: false }}>{h.emoji}</Text>
                  </Enso>
                  <Txt v="small" numberOfLines={1} style={{ marginTop: 4 }}>
                    {h.name}
                  </Txt>
                  <Txt v="num" color={s ? t.accent : t.muted} style={{ fontSize: 11 }}>
                    {s ? tr('{n} j', { n: s }) : '—'}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Card bg={t.bgAlt} bordered={false} onPress={() => router.push('/habits')} contentStyle={{ padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Feather name="repeat" size={18} color={t.accent} />
            <Txt v="body" style={{ flex: 1 }}>
              {tr('Crée ton premier rituel : boire de l’eau, lire, marcher…')}
            </Txt>
          </Card>
        )}
      </Section>

      {/* ── Journal ── */}
      <JournalCard />

      {/* ── Pensée ── */}
      <View style={{ marginTop: 36, flexDirection: 'row', gap: 14, paddingRight: 10 }}>
        <View style={{ width: StyleSheet.hairlineWidth * 3, backgroundColor: t.accent }} />
        <Txt style={{ flex: 1, fontFamily: t.font.mincho, fontSize: 17, lineHeight: 27, color: t.inkSoft }}>{capitalize(thoughtOfDay())}</Txt>
      </View>
    </Screen>
  );
}

function Tile({ n, label, jp, bg, onPress }: { n: number; label: string; jp: string; bg?: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Card bg={bg} bordered={!bg} style={{ flex: 1 }} onPress={onPress} contentStyle={{ paddingVertical: 12, paddingHorizontal: 12, gap: 2 }}>
      <Txt v="jp" color={t.accent} style={{ fontSize: 10, letterSpacing: 1 }}>
        {jp}
      </Txt>
      <Txt style={{ fontFamily: t.font.mincho, fontSize: 30, lineHeight: 38 }}>{n}</Txt>
      <Txt v="small" color={t.inkSoft} style={{ fontSize: 11.5 }}>
        {label}
      </Txt>
    </Card>
  );
}

function plusHour(time: string): string {
  const m = Math.min(timeToMinutes(time) + 60, 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
