import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';
import { loadDB } from '../data/storage';
import { Note } from '../data/types';
import { SWATCHES } from '../theme';
import { loadNoteChoices, setNoteChoice } from './choice';
import { pickNotes } from './NotesWidget';
import { renderFor } from './taskHandler';
import { resolveLang, setLang, tr } from '../i18n';

// Écran ouvert par Android quand on configure un widget Notes (appui long → Configurer).
// Il tourne hors de l'app (pas de thème ni de polices chargées) : styles simples.

export function NotesConfigScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const dark = useColorScheme() === 'dark';
  const c: Colors = dark
    ? { bg: '#181C16', card: '#222820', ink: '#E6EADB', muted: '#8E9A86', line: '#343C31', accent: '#9DB58F', on: '#181C16' }
    : { bg: '#EEF0E5', card: '#F8F8F1', ink: '#2E372D', muted: '#7C8875', line: '#D3D9C6', accent: '#6F8A63', on: '#F8F8F1' };
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadDB(), loadNoteChoices()]).then(([db, choices]) => {
      setLang(resolveLang(db.settings.language));
      setNotes(pickNotes(db));
      setCurrent(choices[String(widgetInfo.widgetId)] ?? null);
    });
  }, [widgetInfo.widgetId]);

  const choose = async (id: string | null) => {
    await setNoteChoice(widgetInfo.widgetId, id);
    renderWidget(await renderFor(widgetInfo.widgetName, await loadDB(), widgetInfo));
    setResult('ok');
  };

  return (
    <View style={[s.wrap, { backgroundColor: c.bg }]}>
      <Text style={[s.kicker, { color: c.accent }]}>覚書 · {tr('WIDGET NOTES')}</Text>
      <Text style={[s.h1, { color: c.ink }]}>{tr('Quelle note afficher ?')}</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        <Row c={c} current={current} onChoose={choose} id={null} title={tr('Automatique')} sub={tr('La note épinglée, sinon la plus récente')} />
        {(notes ?? []).map((n) => (
          <Row
            c={c}
            current={current}
            onChoose={choose}
            key={n.id}
            id={n.id}
            title={(n.pinned ? '◆ ' : '') + (n.title.trim() || n.body.split('\n')[0] || tr('Sans titre'))}
            sub={n.title.trim() ? n.body.replace(/\s+/g, ' ').slice(0, 60) : undefined}
            color={dark ? SWATCHES[n.color].nuit : SWATCHES[n.color].jour}
          />
        ))}
        {notes && notes.length === 0 ? <Text style={[s.sub, { color: c.muted, textAlign: 'center', marginTop: 20 }]}>{tr('Aucune note pour l’instant.')}</Text> : null}
      </ScrollView>
      <Pressable onPress={() => setResult('cancel')} style={[s.cancel, { borderColor: c.line }]} accessibilityRole="button">
        <Text style={{ color: c.ink, fontSize: 15 }}>{tr('Annuler')}</Text>
      </Pressable>
    </View>
  );
}

type Colors = { bg: string; card: string; ink: string; muted: string; line: string; accent: string; on: string };

function Row({ c, current, onChoose, id, title, sub, color }: { c: Colors; current: string | null; onChoose: (id: string | null) => void; id: string | null; title: string; sub?: string; color?: string }) {
  const active = current === id;
  return (
    <Pressable
      onPress={() => onChoose(id)}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [s.row, { backgroundColor: pressed ? c.line : c.card, borderColor: active ? c.accent : c.line, borderWidth: active ? 1.5 : StyleSheet.hairlineWidth * 2 }]}
    >
      <View style={[s.dot, { backgroundColor: color ?? c.accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color: c.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={[s.sub, { color: c.muted }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {active ? <Text style={{ color: c.accent, fontSize: 16 }}>✓</Text> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20, paddingTop: 48, paddingBottom: 24 },
  kicker: { fontSize: 11, letterSpacing: 1.5, marginBottom: 4 },
  h1: { fontSize: 26, marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontSize: 15.5 },
  sub: { fontSize: 12, marginTop: 2 },
  cancel: { marginTop: 10, alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 11, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth * 2 },
});
