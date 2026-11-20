import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { NoteCard } from '../../components/items';
import { TagChip } from '../../components/TagEditor';
import { Chip, Empty, Fab, Header, IconBtn, Screen } from '../../components/ui';
import { useStore } from '../../data/store';
import { Note } from '../../data/types';
import { allTags, hasTag, tagQuery } from '../../lib/tags';
import { tr, trn } from '../../i18n';
import { useTheme } from '../../theme';

type Filter = 'toutes' | 'epinglees' | 'liees';

export default function Notes() {
  const t = useTheme();
  const { db, upsertNote } = useStore();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('toutes');
  const [tag, setTag] = useState<string | null>(null);
  const tags = useMemo(() => allTags(db.notes), [db.notes]);
  const activeTag = tag && tags.some((x) => x.tag === tag) ? tag : null;

  const notes = useMemo(() => {
    const query = q.trim().toLowerCase();
    const byTag = tagQuery(q); // « #mot » dans la recherche = filtre par tag
    return db.notes
      .filter((n) => (filter === 'epinglees' ? n.pinned : filter === 'liees' ? !!n.eventId : true))
      .filter((n) => !activeTag || (n.tags ?? []).includes(activeTag))
      .filter((n) =>
        byTag !== null
          ? hasTag(n, byTag)
          : !query || n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query) || (n.tags ?? []).some((x) => x.includes(query)),
      )
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [db.notes, q, filter, activeTag]);

  /** Appui long sur un tag : le retirer de toutes les notes. */
  const removeTagEverywhere = (name: string, count: number) =>
    Alert.alert(tr('Supprimer #{name} ?', { name }), trn(count, 'Le tag sera retiré de {n} note. Les notes elles-mêmes sont gardées.', 'Le tag sera retiré de {n} notes. Les notes elles-mêmes sont gardées.'), [
      { text: tr('Annuler'), style: 'cancel' },
      {
        text: tr('Retirer'),
        style: 'destructive',
        onPress: () => {
          for (const n of db.notes) {
            if (!n.tags?.includes(name)) continue;
            const rest = n.tags.filter((x) => x !== name);
            upsertNote({ ...n, tags: rest.length ? rest : undefined });
          }
          if (tag === name) setTag(null);
        },
      },
    ]);

  // Mosaïque : chaque note va dans la colonne la plus courte (estimation par longueur de texte)
  const [left, right] = useMemo(() => {
    const cols: [Note[], Note[]] = [[], []];
    const h = [0, 0];
    for (const n of notes) {
      const est = 80 + Math.min(7, Math.ceil((n.body.length || 1) / 22)) * 19 + (n.title ? 26 : 0) + (n.tags?.length ? 24 : 0);
      const i = h[0] <= h[1] ? 0 : 1;
      cols[i].push(n);
      h[i] += est;
    }
    return cols;
  }, [notes]);

  return (
    <View style={{ flex: 1 }}>
      <Screen komorebi komorebiHeight={240}>
        <Header
          kicker={trn(db.notes.length, '{n} note', '{n} notes')}
          title={tr('Notes')}
          jp="覚え書き"
          right={<IconBtn icon="search" label={tr('Rechercher partout')} onPress={() => router.push('/search')} />}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: t.line,
            borderRadius: 999,
            backgroundColor: t.card,
            paddingHorizontal: 16,
          }}
        >
          <Feather name="search" size={16} color={t.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={tr('Chercher dans les notes…')}
            placeholderTextColor={t.muted}
            selectionColor={t.selection}
            cursorColor={t.accent}
            selectionHandleColor={t.accent}
            style={{ flex: 1, fontFamily: t.font.regular, fontSize: 15, color: t.ink, paddingVertical: 11 }}
          />
          {q ? <Feather name="x" size={16} color={t.muted} onPress={() => setQ('')} /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: tags.length ? 10 : 18 }}>
          <Chip label={tr('Toutes')} active={filter === 'toutes'} onPress={() => setFilter('toutes')} />
          <Chip label={tr('Épinglées')} icon="bookmark" active={filter === 'epinglees'} onPress={() => setFilter('epinglees')} />
          <Chip label={tr('Liées')} icon="link-2" active={filter === 'liees'} onPress={() => setFilter('liees')} />
        </View>
        {tags.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, marginBottom: 18 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
            {tags.map(({ tag: name, count }) => (
              <TagChip key={name} name={name} count={count} active={activeTag === name} onPress={() => setTag(activeTag === name ? null : name)} onLongPress={() => removeTagEverywhere(name, count)} />
            ))}
          </ScrollView>
        ) : null}

        {notes.length === 0 ? (
          <Empty
            jp={q || activeTag ? '空' : '白'}
            title={q || activeTag ? tr('Introuvable.') : tr('Carnet vierge.')}
            hint={
              activeTag && !q
                ? tr('Aucune note #{tag} avec ce filtre.', { tag: activeTag })
                : q
                  ? tr('Aucune note ne contient ce texte.')
                  : tr('Les idées s’envolent, les notes restent. Touche + pour écrire.')
            }
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              {left.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {right.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </View>
          </View>
        )}
      </Screen>
      <Fab label={tr('Nouvelle note')} onPress={() => router.push('/note/new')} />
    </View>
  );
}
