import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useStore } from '../data/store';
import { todayKey } from '../lib/date';
import { MOODS } from '../lib/journal';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { Chip, Section, tap, Txt } from './ui';

/** 日記 — sur l'écran Jour : le ciel de la journée et une ligne, rien de plus. */
export function JournalCard() {
  const t = useTheme();
  const { db, setJournal } = useStore();
  const today = todayKey();
  const entry = db.journal.find((j) => j.date === today);
  const [text, setText] = useState(entry?.text ?? '');

  return (
    <Section jp="日記" title={tr('Ta journée')} right={<Chip label={tr('Le mois')} onPress={() => router.push('/journal')} />}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {MOODS.map((m) => {
          const active = entry?.mood === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => {
                tap();
                setJournal(today, { mood: active ? undefined : m.id });
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tr(m.label)}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingVertical: 10,
                borderRadius: 18,
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: active ? 'transparent' : t.line,
                backgroundColor: active ? t.swatch(m.swatch) : pressed ? t.bgAlt : 'transparent',
              })}
            >
              <Txt v="jp" color={active ? t.onSwatch(m.swatch) : t.accent} style={{ fontSize: 22, letterSpacing: 0 }}>
                {m.kanji}
              </Txt>
              <Txt v="small" color={active ? t.onSwatch(m.swatch) : t.muted} style={{ fontSize: 11 }}>
                {tr(m.label)}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={() => setJournal(today, { text: text.trim() || undefined })}
        placeholder={tr('Une ligne pour aujourd’hui…')}
        placeholderTextColor={t.muted}
        selectionColor={t.selection}
        cursorColor={t.accent}
        selectionHandleColor={t.accent}
        maxLength={140}
        returnKeyType="done"
        style={{
          marginTop: 10,
          fontFamily: t.font.mincho,
          fontSize: 16,
          color: t.ink,
          paddingVertical: 8,
          borderBottomWidth: StyleSheet.hairlineWidth * 2,
          borderColor: t.line,
        }}
      />
    </Section>
  );
}
