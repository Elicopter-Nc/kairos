import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { close, EditorShell, Label } from '../components/editor';
import { Card, Btn, Chip, Empty, IconBtn, success, SwatchPicker, tap, Txt } from '../components/ui';
import { newId, useStore } from '../data/store';
import { Habit, Swatch } from '../data/types';
import { addDays, DAYS_MIN, fromKey, mondayIndex, todayKey } from '../lib/date';
import { bestStreak, streak } from '../lib/stats';
import { tr } from '../i18n';
import { useTheme } from '../theme';

const IDEAS: { name: string; emoji: string; color: Swatch }[] = [
  { name: 'Boire 1,5 L', emoji: '💧', color: 'ciel' },
  { name: 'Lire', emoji: '📖', color: 'lilas' },
  { name: 'Marcher', emoji: '🚶', color: 'menthe' },
  { name: 'Méditer', emoji: '🧘', color: 'rose' },
  { name: 'Sport', emoji: '💪', color: 'tomate' },
  { name: 'Pas d’écran au lit', emoji: '🌙', color: 'encre' },
];

const WEEKS = 8;

export default function Habits() {
  const t = useTheme();
  const { db, upsertHabit, deleteHabit, toggleHabit } = useStore();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✦');
  const [color, setColor] = useState<Swatch>('menthe');
  const today = todayKey();

  const add = (h?: { name: string; emoji: string; color: Swatch }) => {
    const n = (h?.name ?? name).trim();
    if (!n) return;
    upsertHabit({ id: newId(), name: n, emoji: h?.emoji ?? (emoji.trim() || '✦'), color: h?.color ?? color, log: [], createdAt: Date.now() });
    success();
    setName('');
    setEmoji('✦');
  };

  // grille : WEEKS semaines, lundi → dimanche, la dernière colonne contient aujourd'hui
  const start = addDays(today, -mondayIndex(fromKey(today)) - (WEEKS - 1) * 7);

  return (
    <EditorShell kicker={tr('Rituels')} jp="習慣" onSave={close} saveLabel={tr('Fini')} closeLabel={tr('Fermer')}>
      <Txt v="display" style={{ marginBottom: 4 }}>
        {tr('Rituels')}
      </Txt>
      <Txt v="body" color={t.muted} style={{ marginBottom: 18 }}>
        {tr('Les petites choses répétées chaque jour. Coche-les depuis l’écran Jour, ou touche une case ci-dessous pour rattraper un oubli.')}
      </Txt>

      {db.habits.length === 0 ? <Empty jp="習" title={tr('Aucun rituel.')} hint={tr('Choisis une idée ci-dessous ou crée le tien.')} /> : null}

      {db.habits.map((h) => (
        <HabitCard
          key={h.id}
          h={h}
          start={start}
          today={today}
          onToggle={(d) => toggleHabit(h.id, d)}
          onRename={(nm) => upsertHabit({ ...h, name: nm })}
          onDelete={() =>
            Alert.alert(tr('Supprimer « {name} » ?', { name: h.name }), tr('L’historique sera perdu.'), [
              { text: tr('Annuler'), style: 'cancel' },
              { text: tr('Supprimer'), style: 'destructive', onPress: () => deleteHabit(h.id) },
            ])
          }
        />
      ))}

      <Label jp="新規">{tr('Nouveau rituel')}</Label>
      <Card radius={18} contentStyle={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput
            value={emoji}
            onChangeText={(v) => setEmoji([...v].slice(-2).join(''))}
            style={{
              width: 54,
              textAlign: 'center',
              fontSize: 24,
              borderWidth: 0,
              borderRadius: 12,
              color: t.ink,
              backgroundColor: t.swatch(color),
            }}
            accessibilityLabel={tr('Emoji')}
          />
          <TextInput
            value={name}
            onChangeText={setName}
            onSubmitEditing={() => add()}
            placeholder={tr('Ex : Écrire 3 lignes')}
            placeholderTextColor={t.muted}
            selectionColor={t.selection}
            cursorColor={t.accent}
            selectionHandleColor={t.accent}
            style={{ flex: 1, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, borderRadius: 14, paddingHorizontal: 14, fontFamily: t.font.regular, fontSize: 15.5, color: t.ink }}
          />
        </View>
        <SwatchPicker value={color} onChange={setColor} />
        <Btn label={tr('Ajouter')} icon="plus" onPress={() => add()} />
      </Card>

      <Label>{tr('Idées')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {IDEAS.filter((i) => !db.habits.some((h) => h.name === i.name || h.name === tr(i.name))).map((i) => (
          <Chip key={i.name} label={`${i.emoji} ${tr(i.name)}`} onPress={() => add({ ...i, name: tr(i.name) })} />
        ))}
      </View>
    </EditorShell>
  );
}

function HabitCard({
  h,
  start,
  today,
  onToggle,
  onDelete,
  onRename,
}: {
  h: Habit;
  start: string;
  today: string;
  onToggle: (d: string) => void;
  onDelete: () => void;
  onRename: (n: string) => void;
}) {
  const t = useTheme();
  const set = new Set(h.log);
  const s = streak(h);
  const color = t.swatch(h.color);
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(today, -i)).filter((d) => set.has(d)).length;

  return (
    <Card radius={18} style={{ marginBottom: 14 }} contentStyle={{ padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22, lineHeight: 28, textAlign: 'center', includeFontPadding: false }}>{h.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <TextInput
            defaultValue={h.name}
            onEndEditing={(e) => e.nativeEvent.text.trim() && onRename(e.nativeEvent.text.trim())}
            style={{ fontFamily: t.font.mincho, fontSize: 18, color: t.ink, padding: 0 }}
          />
          <Txt v="small" color={t.muted}>
            {s ? tr('{n} j de suite', { n: s }) : tr('Pas de série en cours')} · {tr('record {n} · {d}/30 j', { n: bestStreak(h), d: last30 })}
          </Txt>
        </View>
        <IconBtn icon="trash-2" label={tr('Supprimer {name}', { name: h.name })} onPress={onDelete} size={36} />
      </View>

      <View style={{ flexDirection: 'row', marginTop: 14, gap: 4 }}>
        <View style={{ gap: 4, marginRight: 2 }}>
          {DAYS_MIN.map((d, i) => (
            <Txt key={i} v="kicker" color={t.muted} style={{ fontSize: 8, height: 18, lineHeight: 18 }}>
              {d}
            </Txt>
          ))}
        </View>
        {Array.from({ length: WEEKS }, (_, w) => (
          <View key={w} style={{ flex: 1, gap: 4 }}>
            {Array.from({ length: 7 }, (_, d) => {
              const key = addDays(start, w * 7 + d);
              const future = key > today;
              const done = set.has(key);
              return (
                <Pressable
                  key={d}
                  disabled={future}
                  onPress={() => {
                    tap();
                    onToggle(key);
                  }}
                  accessibilityLabel={`${key} ${done ? tr('fait') : tr('non fait')}`}
                  style={{
                    height: 18,
                    borderRadius: 5,
                    borderWidth: key === today ? 1.5 : 0,
                    borderColor: t.accent,
                    backgroundColor: done ? t.accent : future ? 'transparent' : t.bgAlt,
                    opacity: future ? 0.2 : 1,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </Card>
  );
}
