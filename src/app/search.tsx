import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { close } from '../components/editor';
import { EventItem, TaskItem } from '../components/items';
import { Chip, Empty, Grain, IconBtn, Section, tap, Txt } from '../components/ui';
import { occurrences, Occurrence } from '../data/recurrence';
import { useStore } from '../data/store';
import { CalEvent, Note } from '../data/types';
import { addDays, formatShort, toKey, todayKey } from '../lib/date';
import { allTags, hasTag, tagQuery } from '../lib/tags';
import { tr, trn } from '../i18n';
import { useTheme } from '../theme';

// ─── Recherche insensible à la casse et aux accents ──────────────────────
/** Replie un texte (minuscules, sans accents) en gardant la correspondance avec les positions d'origine. */
function fold(text: string): { norm: string; map: number[] } {
  let norm = '';
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const f = text[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (let k = 0; k < f.length; k++) {
      norm += f[k];
      map.push(i);
    }
  }
  return { norm, map };
}

const foldQuery = (q: string) => q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function matches(text: string | undefined, q: string): boolean {
  return !!text && fold(text).norm.includes(q);
}

/** Extrait autour de la première occurrence : [avant, trouvé, après]. */
function excerpt(text: string, q: string, radius = 38): [string, string, string] | null {
  const { norm, map } = fold(text);
  const at = norm.indexOf(q);
  if (at < 0) return null;
  const start = map[at];
  const end = map[at + q.length - 1] + 1;
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, end + radius);
  const flat = (s: string) => s.replace(/\s+/g, ' ');
  return [(from > 0 ? '…' : '') + flat(text.slice(from, start)), text.slice(start, end), flat(text.slice(end, to)) + (to < text.length ? '…' : '')];
}

function nextOccurrence(ev: CalEvent, today: string): Occurrence {
  const next = occurrences(ev, today, addDays(today, 400))[0];
  return { event: ev, date: next ?? ev.date };
}

export default function Search() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { db } = useStore();
  const [query, setQuery] = useState('');
  const q = foldQuery(query);
  const today = todayKey();

  const tags = useMemo(() => allTags([...db.notes, ...db.tasks]), [db.notes, db.tasks]);
  const byTag = tagQuery(query); // « #mot » = seulement les notes qui ont ce tag

  const results = useMemo(() => {
    if (byTag !== null) {
      const notes = db.notes.filter((n) => hasTag(n, byTag)).sort((a, b) => b.updatedAt - a.updatedAt);
      const tasks = db.tasks.filter((x) => hasTag(x, byTag)).sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? '9999').localeCompare(b.due ?? '9999'));
      return { tasks, events: [], notes, total: notes.length + tasks.length };
    }
    if (q.length < 2) return null;
    const tasks = db.tasks
      .filter((x) => matches(x.title, q) || matches(x.notes, q) || x.subtasks.some((s) => matches(s.text, q)) || (x.tags ?? []).some((y) => matches(y, q)))
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? '9999').localeCompare(b.due ?? '9999'));
    const events = db.events
      .filter((e) => matches(e.title, q) || matches(e.location, q) || matches(e.description, q))
      .map((e) => nextOccurrence(e, today))
      .sort((a, b) => {
        const fa = a.date >= today;
        const fb = b.date >= today;
        if (fa !== fb) return fa ? -1 : 1; // à venir d'abord, puis passés
        return fa ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      });
    const notes = db.notes
      .filter((n) => matches(n.title, q) || matches(n.body, q) || (n.tags ?? []).some((x) => matches(x, q)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return { tasks, events, notes, total: tasks.length + events.length + notes.length };
  }, [db, q, today, byTag]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line }}>
        <IconBtn icon="arrow-left" label={tr('Retour')} onPress={close} size={38} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, backgroundColor: t.card, paddingHorizontal: 14 }}>
          <Feather name="search" size={16} color={t.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            placeholder={tr('Tâches, événements, notes…')}
            placeholderTextColor={t.muted}
            selectionColor={t.selection}
            cursorColor={t.accent}
            selectionHandleColor={t.accent}
            style={{ flex: 1, fontFamily: t.font.regular, fontSize: 15.5, color: t.ink, paddingVertical: 10 }}
          />
          {query ? <Feather name="x" size={16} color={t.muted} onPress={() => setQuery('')} accessibilityLabel={tr('Effacer la recherche')} /> : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {!results ? (
          <View style={{ marginTop: 30 }}>
            <Empty jp="探" title={tr('Chercher partout.')} hint={tr('Tape au moins deux lettres. Les accents et majuscules ne comptent pas.')} />
            {tags.length ? (
              <View style={{ marginTop: 26 }}>
                <Txt v="kicker" color={t.muted} style={{ marginBottom: 10 }}>
                  Tags
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {tags.map(({ tag, count }) => (
                    <Chip key={tag} label={`#${tag}  ${count}`} onPress={() => setQuery(`#${tag}`)} />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : results.total === 0 ? (
          <View style={{ marginTop: 30 }}>
            <Empty jp="空" title={tr('Rien trouvé.')} hint={byTag !== null ? tr('Aucune note ni tâche n’a le tag #{tag}.', { tag: byTag }) : tr('Aucune tâche, aucun événement ni aucune note ne contient « {q} ».', { q: query.trim() })} />
          </View>
        ) : (
          <>
            <Txt v="kicker" color={t.muted}>
              {trn(results.total, '{n} résultat', '{n} résultats')}
            </Txt>
            {results.tasks.length ? (
              <Section jp="やること" title={tr('Tâches · {n}', { n: results.tasks.length })} style={{ marginTop: 18 }}>
                {results.tasks.map((x) => {
                  const hit = matches(x.title, q) ? null : excerpt(x.notes && matches(x.notes, q) ? x.notes : x.subtasks.find((s) => matches(s.text, q))?.text ?? '', q);
                  return (
                    <View key={x.id}>
                      <TaskItem task={x} />
                      {hit ? <Hit parts={hit} style={{ marginTop: -4, marginBottom: 10, marginLeft: 14 }} /> : null}
                    </View>
                  );
                })}
              </Section>
            ) : null}
            {results.events.length ? (
              <Section jp="予定" title={tr('Événements · {n}', { n: results.events.length })} style={{ marginTop: 22 }}>
                {results.events.map((o) => {
                  const e = o.event;
                  const hit = matches(e.title, q) ? null : excerpt(matches(e.location, q) ? e.location! : e.description ?? '', q);
                  return (
                    <View key={e.id}>
                      <EventItem occ={o} showDate />
                      {hit ? <Hit parts={hit} style={{ marginTop: -4, marginBottom: 10, marginLeft: 14 }} /> : null}
                    </View>
                  );
                })}
              </Section>
            ) : null}
            {results.notes.length ? (
              <Section jp="覚え書き" title={`Notes · ${results.notes.length}`} style={{ marginTop: 22 }}>
                {results.notes.map((n) => (
                  <NoteRow key={n.id} note={n} q={q} />
                ))}
              </Section>
            ) : null}
          </>
        )}
      </ScrollView>
      <Grain />
    </KeyboardAvoidingView>
  );
}

function Hit({ parts, style, color }: { parts: [string, string, string]; style?: object; color?: string }) {
  const t = useTheme();
  return (
    <Text numberOfLines={2} style={[{ fontFamily: t.font.regular, fontSize: 13, lineHeight: 19, color: color ?? t.inkSoft }, style]}>
      {parts[0]}
      <Text style={{ backgroundColor: t.accentSoft, color: t.ink, fontFamily: t.font.medium }}>{parts[1]}</Text>
      {parts[2]}
    </Text>
  );
}

function NoteRow({ note, q }: { note: Note; q: string }) {
  const t = useTheme();
  const titleHit = note.title ? excerpt(note.title, q, 80) : null;
  const bodyHit = excerpt(note.body, q);
  const fallback = note.body.replace(/\s+/g, ' ').trim().slice(0, 90);
  return (
    <Pressable
      onPress={() => {
        tap();
        router.push(`/note/${note.id}`);
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 12,
        alignItems: 'stretch',
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 8,
        borderRadius: 18,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: t.line,
        backgroundColor: pressed ? t.bgAlt : t.card,
      })}
    >
      <View style={{ width: 4, borderRadius: 2, backgroundColor: t.swatch(note.color) }} />
      <View style={{ flex: 1, gap: 3 }}>
        {titleHit ? <Hit parts={titleHit} color={t.ink} style={{ fontFamily: t.font.mincho, fontSize: 16, lineHeight: 22 }} /> : note.title ? <Txt v="h2" style={{ fontSize: 16 }}>{note.title}</Txt> : null}
        {bodyHit ? <Hit parts={bodyHit} /> : fallback ? <Txt v="small" color={t.inkSoft} numberOfLines={2}>{fallback}</Txt> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <Feather name={note.photos?.length ? 'image' : 'clock'} size={11} color={t.muted} />
          <Txt v="small" color={t.muted} style={{ fontSize: 11 }}>
            {formatShort(toKey(new Date(note.updatedAt)))}
            {note.photos?.length ? ` · ${trn(note.photos.length, '{n} photo', '{n} photos')}` : ''}
            {note.tags?.length ? `  ·  ${note.tags.map((x) => '#' + x).join(' ')}` : ''}
          </Txt>
        </View>
      </View>
    </Pressable>
  );
}
