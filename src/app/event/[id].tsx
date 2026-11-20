import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { close, EditorShell, Label, PickField } from '../../components/editor';
import { NoteCard, TaskItem } from '../../components/items';
import { MapPreview } from '../../components/MapPreview';
import { PlacePicker } from '../../components/PlacePicker';
import { Btn, Chip, Field, IconBtn, SwatchPicker, Toggle, Txt } from '../../components/ui';
import { newId, useStore } from '../../data/store';
import { CalEvent, RECURRENCE_LABELS, Recurrence, REMINDER_OPTIONS } from '../../data/types';
import { capitalize, formatLong, timeToMinutes, todayKey } from '../../lib/date';
import { MODE_LABEL } from '../../lib/geo';
import { pickDate, pickTime } from '../../lib/pickers';
import { tr } from '../../i18n';
import { useTheme } from '../../theme';

function addHour(time: string): string {
  const m = Math.min(timeToMinutes(time) + 60, 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export default function EventEditor() {
  const t = useTheme();
  const params = useLocalSearchParams<{ id: string; date?: string; start?: string }>();
  const presetStart = params.start && /^\d{2}:\d{2}$/.test(params.start) ? params.start : undefined;
  const { db, upsertEvent, deleteEvent, skipOccurrence } = useStore();
  const existing = db.events.find((e) => e.id === params.id);
  const occDate = params.date || existing?.date || todayKey();

  const [ev, setEv] = useState<CalEvent>(
    () =>
      existing ?? {
        id: newId(),
        title: '',
        date: params.date || todayKey(),
        allDay: false,
        start: presetStart ?? '09:00',
        end: presetStart ? addHour(presetStart) : '10:00',
        color: 'tomate',
        reminder: 15,
        recurrence: 'none',
        createdAt: Date.now(),
      },
  );
  const set = (p: Partial<CalEvent>) => setEv((e) => ({ ...e, ...p }));

  const linkedNotes = existing ? db.notes.filter((n) => n.eventId === ev.id && (!n.eventDate || n.eventDate === occDate || ev.recurrence === 'none')) : [];
  const linkedTasks = existing ? db.tasks.filter((x) => x.eventId === ev.id) : [];

  const save = () => {
    if (!ev.title.trim()) {
      Alert.alert(tr('Il manque un titre'), tr('Donne un nom à ton événement.'));
      return;
    }
    let { start, end } = ev;
    if (!ev.allDay && start && end && timeToMinutes(end) <= timeToMinutes(start)) end = addHour(start);
    upsertEvent({ ...ev, title: ev.title.trim(), start, end });
    close();
  };

  const remove = () => {
    if (!existing) return close();
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [{ text: tr('Annuler'), style: 'cancel' }];
    if (existing.recurrence !== 'none') {
      buttons.push({
        text: tr('Cette fois seulement'),
        onPress: () => {
          skipOccurrence(existing.id, occDate);
          close();
        },
      });
    }
    buttons.push({
      text: existing.recurrence !== 'none' ? tr('Toute la série') : tr('Supprimer'),
      style: 'destructive',
      onPress: () => {
        deleteEvent(existing.id);
        close();
      },
    });
    Alert.alert(tr('Supprimer l’événement ?'), tr('Il reste 30 jours dans la corbeille. Les notes et tâches liées sont conservées, seul le lien disparaît.'), buttons);
  };

  return (
    <EditorShell
      kicker={existing ? tr('Modifier l’événement') : tr('Nouvel événement')}
      jp="予定"
      onSave={save}
      extraActions={existing ? <IconBtn icon="trash-2" label={tr('Supprimer')} onPress={remove} size={40} /> : undefined}
    >
      <Field big value={ev.title} onChangeText={(title) => set({ title })} placeholder={tr('Titre de l’événement')} autoFocus={!existing} />

      <Label jp="色">{tr('Couleur')}</Label>
      <SwatchPicker value={ev.color} onChange={(color) => set({ color })} />

      <View style={{ height: 18 }} />
      <PickField
        icon="calendar"
        label={ev.recurrence === 'none' ? tr('Date') : tr('À partir du')}
        value={capitalize(formatLong(ev.date))}
        placeholder={tr('Choisir')}
        onPress={async () => {
          const d = await pickDate(ev.date);
          if (d) set({ date: d });
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 }}>
        <Txt v="bodyB" style={{ flex: 1 }}>
          {tr('Toute la journée')}
        </Txt>
        <Toggle value={ev.allDay} onChange={(allDay) => set({ allDay })} />
      </View>

      {!ev.allDay ? (
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
          <PickField
            icon="clock"
            label={tr('Début')}
            value={ev.start}
            placeholder="--:--"
            onPress={async () => {
              const v = await pickTime(ev.start, ev.date);
              if (v) set({ start: v, end: ev.end && timeToMinutes(ev.end) > timeToMinutes(v) ? ev.end : addHour(v) });
            }}
          />
          <PickField
            icon="clock"
            label={tr('Fin')}
            value={ev.end}
            placeholder="--:--"
            onPress={async () => {
              const v = await pickTime(ev.end, ev.date);
              if (v) set({ end: v });
            }}
          />
        </View>
      ) : null}

      <Label jp="毎回">{tr('Répétition')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(RECURRENCE_LABELS) as Recurrence[]).map((r) => (
          <Chip key={r} label={tr(RECURRENCE_LABELS[r])} active={ev.recurrence === r} onPress={() => set({ recurrence: r })} />
        ))}
      </View>
      {ev.recurrence !== 'none' ? (
        <View style={{ marginTop: 12 }}>
          <PickField
            icon="flag"
            label={tr('Jusqu’au (facultatif)')}
            value={ev.until ? capitalize(formatLong(ev.until)) : undefined}
            placeholder={tr('Sans fin')}
            onPress={async () => {
              const d = await pickDate(ev.until ?? ev.date);
              if (d) set({ until: d });
            }}
            onClear={() => set({ until: undefined })}
          />
        </View>
      ) : null}

      <Label jp="時">{tr('Rappel')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {REMINDER_OPTIONS.map((o) => (
          <Chip key={o.label} label={tr(o.label)} active={ev.reminder === o.value} onPress={() => set({ reminder: o.value })} />
        ))}
      </View>
      {ev.allDay && ev.reminder !== null ? (
        <Txt v="small" color={t.muted} style={{ marginTop: 6 }}>
          {tr('Pour un événement sur la journée, le rappel se base sur 9 h.')}
        </Txt>
      ) : null}

      <View style={{ height: 18 }} />
      <PlacePicker value={ev.location} geo={ev.geo} onChange={(location, geo) => set({ location, geo, leaveAlert: geo ? ev.leaveAlert : false })} />
      {ev.geo ? (
        <View style={{ marginTop: -4, marginBottom: 16, gap: 12 }}>
          <MapPreview lat={ev.geo.lat} lon={ev.geo.lon} label={ev.geo.label} mode={db.settings.travelMode} />
          {!ev.allDay ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Txt v="body">{tr('Me prévenir quand partir')}</Txt>
                <Txt v="small" color={t.muted}>
                  {tr('Selon le trajet {mode} depuis ta position (réglage dans Plus).', { mode: tr(MODE_LABEL[db.settings.travelMode]) })}
                </Txt>
              </View>
              <Toggle value={!!ev.leaveAlert} onChange={(leaveAlert) => set({ leaveAlert })} />
            </View>
          ) : null}
        </View>
      ) : null}
      <Field
        label={tr('Détails')}
        value={ev.description}
        onChangeText={(description) => set({ description })}
        placeholder={tr('Ordre du jour, code d’accès, à apporter…')}
        multiline
        style={{ minHeight: 90 }}
      />

      {/* ── Liens ── */}
      <Label>{ev.recurrence !== 'none' ? tr('Notes liées · {date}', { date: formatLong(occDate) }) : tr('Notes liées')}</Label>
      {existing ? (
        <>
          {linkedNotes.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
          <Btn
            label={tr('Prendre une note pour cet événement')}
            icon="feather"
            kind="plain"
            small
            style={{ alignSelf: 'flex-start' }}
            onPress={() => router.push({ pathname: '/note/[id]', params: { id: 'new', eventId: ev.id, eventDate: occDate } })}
          />
          <Label jp="やること">{tr('Tâches liées')}</Label>
          {linkedTasks.map((x) => (
            <TaskItem key={x.id} task={x} compact />
          ))}
          <Btn
            label={tr('Ajouter une tâche liée')}
            icon="check-square"
            kind="plain"
            small
            style={{ alignSelf: 'flex-start' }}
            onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new', eventId: ev.id, due: occDate } })}
          />
        </>
      ) : (
        <Txt v="small" color={t.muted}>
          {tr('Enregistre l’événement pour pouvoir y attacher des notes et des tâches.')}
        </Txt>
      )}
    </EditorShell>
  );
}
