import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { close, EditorShell, EventPicker, Label, LinkedEventChip, PickField } from '../../components/editor';
import { TagEditor } from '../../components/TagEditor';
import { Check, Chip, Field, IconBtn, tap, Toggle, Txt } from '../../components/ui';
import { newId, useStore } from '../../data/store';
import { repeatLabel } from '../../data/tasks';
import { Priority, Task, TaskRepeat } from '../../data/types';
import { addDays, capitalize, formatLong, todayKey } from '../../lib/date';
import { pickDate, pickTime } from '../../lib/pickers';
import { allTags } from '../../lib/tags';
import { tr } from '../../i18n';
import { useTheme } from '../../theme';

export default function TaskEditor() {
  const t = useTheme();
  const params = useLocalSearchParams<{ id: string; list?: string; due?: string; eventId?: string }>();
  const { db, upsertTask, deleteTask } = useStore();
  const existing = db.tasks.find((x) => x.id === params.id);
  const [picker, setPicker] = useState(false);
  const [sub, setSub] = useState('');

  const [task, setTask] = useState<Task>(
    () =>
      existing ?? {
        id: newId(),
        title: '',
        done: false,
        due: params.due || undefined,
        remind: false,
        priority: 0,
        list: params.list || db.settings.lists[0] || 'Perso',
        eventId: params.eventId || undefined,
        subtasks: [],
        createdAt: Date.now(),
      },
  );
  const set = (p: Partial<Task>) => setTask((x) => ({ ...x, ...p }));
  const today = todayKey();

  const save = () => {
    if (!task.title.trim()) {
      Alert.alert(tr('Il manque un titre'), tr('Que faut-il faire ?'));
      return;
    }
    const pending = sub.trim() ? [...task.subtasks, { id: newId(), text: sub.trim(), done: false }] : task.subtasks;
    upsertTask({ ...task, title: task.title.trim(), subtasks: pending, remind: task.remind && !!task.due && !!task.time });
    close();
  };

  const addSub = () => {
    const text = sub.trim();
    if (!text) return;
    set({ subtasks: [...task.subtasks, { id: newId(), text, done: false }] });
    setSub('');
  };

  const remove = () =>
    Alert.alert(tr('Supprimer la tâche ?'), task.title, [
      { text: tr('Annuler'), style: 'cancel' },
      {
        text: tr('Supprimer'),
        style: 'destructive',
        onPress: () => {
          deleteTask(task.id);
          close();
        },
      },
    ]);

  const PRIOS: { v: Priority; label: string; color: string }[] = [
    { v: 0, label: tr('Normale'), color: t.accentSoft },
    { v: 1, label: tr('Haute'), color: t.swatch('soleil') },
    { v: 2, label: tr('Urgente'), color: t.swatch('tomate') },
  ];

  return (
    <EditorShell
      kicker={existing ? (task.done ? tr('Tâche terminée') : tr('Modifier la tâche')) : tr('Nouvelle tâche')}
      jp="やること"
      onSave={save}
      extraActions={existing ? <IconBtn icon="trash-2" label={tr('Supprimer')} onPress={remove} size={40} /> : undefined}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        {existing ? (
          <View style={{ marginTop: 14 }}>
            <Check done={task.done} onPress={() => set({ done: !task.done, doneAt: !task.done ? Date.now() : undefined })} size={30} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Field big value={task.title} onChangeText={(title) => set({ title })} placeholder={tr('À faire…')} autoFocus={!existing} multiline />
        </View>
      </View>

      {/* Raccourcis d'échéance */}
      <Label jp="時">{tr('Échéance')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <Chip label={tr("Aujourd'hui")} active={task.due === today} onPress={() => set({ due: today })} />
        <Chip label={tr('Demain')} active={task.due === addDays(today, 1)} onPress={() => set({ due: addDays(today, 1) })} />
        <Chip label={tr('Dans 1 sem.')} active={task.due === addDays(today, 7)} onPress={() => set({ due: addDays(today, 7) })} />
        <Chip label={tr('Sans date')} active={!task.due} onPress={() => set({ due: undefined, time: undefined, remind: false })} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <PickField
          icon="calendar"
          label={tr('Jour')}
          value={task.due ? capitalize(formatLong(task.due)) : undefined}
          placeholder={tr('Choisir')}
          onPress={async () => {
            const d = await pickDate(task.due);
            if (d) set({ due: d });
          }}
          style={{ flex: 1.6 }}
        />
        <PickField
          icon="clock"
          label={tr('Heure')}
          value={task.time}
          placeholder="--:--"
          onPress={async () => {
            const v = await pickTime(task.time, task.due);
            if (v) set({ time: v, due: task.due ?? today, remind: true });
          }}
          onClear={() => set({ time: undefined, remind: false })}
        />
      </View>
      {task.time ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 12 }}>
          <Feather name="bell" size={18} color={t.ink} />
          <Txt v="bodyB" style={{ flex: 1 }}>
            {tr('Me le rappeler à {time}', { time: task.time })}
          </Txt>
          <Toggle value={task.remind} onChange={(remind) => set({ remind })} />
        </View>
      ) : null}

      <Label jp="繰">{tr('Répétition')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label={tr('Jamais')} active={!task.repeat} onPress={() => set({ repeat: undefined })} />
        {REPEAT_UNITS.map((u) => (
          <Chip
            key={u.unit}
            label={tr(u.label)}
            active={task.repeat?.unit === u.unit}
            onPress={() => set({ repeat: { every: task.repeat?.unit === u.unit ? task.repeat.every : 1, unit: u.unit }, due: task.due ?? today })}
          />
        ))}
      </View>
      {task.repeat ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <Feather name="repeat" size={17} color={t.accent} />
          <Txt v="bodyB" style={{ flex: 1 }}>
            {repeatLabel(task.repeat)}
          </Txt>
          <Stepper value={task.repeat.every} onChange={(every) => set({ repeat: { ...(task.repeat as TaskRepeat), every } })} />
        </View>
      ) : null}
      {task.repeat ? (
        <Txt v="small" color={t.muted} style={{ marginTop: 6 }}>
          {tr('Quand tu la coches, la suivante apparaît à la prochaine échéance.')}
        </Txt>
      ) : null}

      <Label>{tr('Priorité')}</Label>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {PRIOS.map((p) => (
          <Chip key={p.v} label={p.label} active={task.priority === p.v} color={p.color} onPress={() => set({ priority: p.v })} />
        ))}
      </View>

      <Label>{tr('Liste')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {db.settings.lists.map((l) => (
          <Chip key={l} label={`# ${l}`} active={task.list === l} color={t.bgAlt} onPress={() => set({ list: l })} />
        ))}
      </View>

      <Label jp="札">Tags</Label>
      <TagEditor tags={task.tags ?? []} known={allTags([...db.notes, ...db.tasks]).map((x) => x.tag)} onChange={(tags) => set({ tags: tags.length ? tags : undefined })} />

      {/* Sous-tâches */}
      <Label>{task.subtasks.length ? tr('Étapes · {done}/{total}', { done: task.subtasks.filter((s) => s.done).length, total: task.subtasks.length }) : tr('Étapes')}</Label>
      <View style={{ borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, borderRadius: 16, backgroundColor: t.card, overflow: 'hidden' }}>
        {task.subtasks.map((s, i) => (
          <View
            key={s.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line }}
          >
            <Check
              size={22}
              done={s.done}
              onPress={() => set({ subtasks: task.subtasks.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
            />
            <TextInput
              value={s.text}
              onChangeText={(text) => set({ subtasks: task.subtasks.map((x, j) => (j === i ? { ...x, text } : x)) })}
              style={{
                flex: 1,
                fontFamily: t.font.regular,
                fontSize: 15,
                color: s.done ? t.muted : t.ink,
                textDecorationLine: s.done ? 'line-through' : 'none',
                paddingVertical: 4,
              }}
            />
            <Pressable hitSlop={10} onPress={() => set({ subtasks: task.subtasks.filter((_, j) => j !== i) })} accessibilityLabel={tr("Retirer l'étape")}>
              <Feather name="x" size={16} color={t.muted} />
            </Pressable>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 }}>
          <Feather name="plus" size={18} color={t.muted} />
          <TextInput
            value={sub}
            onChangeText={setSub}
            onSubmitEditing={addSub}
            blurOnSubmit={false}
            placeholder={tr('Ajouter une étape')}
            placeholderTextColor={t.muted}
            selectionColor={t.selection}
            cursorColor={t.accent}
            selectionHandleColor={t.accent}
            style={{ flex: 1, fontFamily: t.font.regular, fontSize: 15, color: t.ink, paddingVertical: 12 }}
          />
        </View>
      </View>

      <View style={{ height: 16 }} />
      <Field label="Notes" value={task.notes} onChangeText={(notes) => set({ notes })} placeholder={tr('Détails, liens, idées…')} multiline style={{ minHeight: 80 }} />

      <Label jp="予定">{tr('Événement lié')}</Label>
      <LinkedEventChip eventId={task.eventId} onPick={() => setPicker(true)} onUnlink={() => set({ eventId: undefined })} />
      <EventPicker visible={picker} onClose={() => setPicker(false)} onPick={(eventId) => set({ eventId })} />
    </EditorShell>
  );
}

const REPEAT_UNITS: { unit: TaskRepeat['unit']; label: string }[] = [
  { unit: 'day', label: 'Jours' },
  { unit: 'week', label: 'Semaines' },
  { unit: 'month', label: 'Mois' },
  { unit: 'year', label: 'Ans' },
];

/** Petit compteur − n + pour « tous les n jours ». */
function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useTheme();
  const btn = (icon: 'minus' | 'plus', next: number, label: string) => (
    <Pressable
      onPress={() => {
        tap();
        onChange(Math.min(99, Math.max(1, next)));
      }}
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, backgroundColor: pressed ? t.bgAlt : 'transparent' })}
    >
      <Feather name={icon} size={15} color={t.ink} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {btn('minus', value - 1, tr('Moins'))}
      <Txt v="num" style={{ minWidth: 20, textAlign: 'center' }}>
        {value}
      </Txt>
      {btn('plus', value + 1, tr('Plus'))}
    </View>
  );
}
