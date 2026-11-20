import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Enso } from '../../components/Enso';
import { DraggableList } from '../../components/DraggableList';
import { TagChip } from '../../components/TagEditor';
import { TaskItem } from '../../components/TaskItem';
import { Chip, Empty, Fab, Header, IconBtn, Screen, Section, Txt } from '../../components/ui';
import { useStore } from '../../data/store';
import { Task } from '../../data/types';
import { addDays, todayKey } from '../../lib/date';
import { allTags } from '../../lib/tags';
import { tr, trn } from '../../i18n';
import { useTheme } from '../../theme';

type Filter = 'jour' | 'avenir' | 'toutes' | 'faites';

export default function Taches() {
  const t = useTheme();
  const { db, clearDone, reorderTasks, upsertTask } = useStore();
  const [tag, setTag] = useState<string | null>(null);
  const tags = useMemo(() => allTags(db.tasks), [db.tasks]);
  const activeTag = tag && tags.some((x) => x.tag === tag) ? tag : null;
  const [filter, setFilter] = useState<Filter>('jour');
  const [reorder, setReorder] = useState(false);
  const [list, setList] = useState<string | null>(null);
  const today = todayKey();

  const sorted = useMemo(() => {
    const base = db.tasks.filter((x) => (!list || x.list === list) && (!activeTag || (x.tags ?? []).includes(activeTag)));
    // l'ordre choisi à la main passe avant tout, puis l'échéance, la priorité et l'heure
    const byDue = (a: Task, b: Task) =>
      (a.order ?? 1e9) - (b.order ?? 1e9) ||
      (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
      b.priority - a.priority ||
      (a.time ?? '99').localeCompare(b.time ?? '99');
    switch (filter) {
      case 'jour':
        return base.filter((x) => !x.done && x.due && x.due <= today).sort(byDue);
      case 'avenir':
        return base.filter((x) => !x.done && x.due && x.due > today).sort(byDue);
      case 'toutes':
        return base.filter((x) => !x.done).sort(byDue);
      case 'faites':
        return base.filter((x) => x.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
    }
  }, [db.tasks, filter, list, today, activeTag]);

  const total = db.tasks.length;
  const done = db.tasks.filter((x) => x.done).length;
  const pct = total ? done / total : 0;

  const groups = useMemo(() => {
    if (filter === 'faites' || filter === 'jour') return [{ title: '', items: sorted }];
    const g: Record<string, Task[]> = { 'En retard': [], "Aujourd'hui": [], Demain: [], 'Cette semaine': [], 'Plus tard': [], 'Sans date': [] };
    for (const x of sorted) {
      if (!x.due) g['Sans date'].push(x);
      else if (x.due < today) g['En retard'].push(x);
      else if (x.due === today) g["Aujourd'hui"].push(x);
      else if (x.due === addDays(today, 1)) g.Demain.push(x);
      else if (x.due <= addDays(today, 7)) g['Cette semaine'].push(x);
      else g['Plus tard'].push(x);
    }
    return Object.entries(g)
      .filter(([, v]) => v.length)
      .map(([k, v]) => ({ title: k, items: v }));
  }, [sorted, filter, today]);

  return (
    <View style={{ flex: 1 }}>
      <Screen komorebi komorebiHeight={240}>
        <Header
          kicker={tr('{done} sur {total} terminées', { done, total })}
          title={tr('Tâches')}
          jp="やること"
          right={
            filter === 'faites' && done ? (
              <IconBtn
                icon="trash-2"
                label={tr('Effacer les tâches terminées')}
                onPress={() =>
                  Alert.alert(tr('Effacer les tâches terminées ?'), trn(done, '{n} tâche ira dans la corbeille (30 jours).', '{n} tâches iront dans la corbeille (30 jours).'), [
                    { text: tr('Annuler'), style: 'cancel' },
                    { text: tr('Effacer'), style: 'destructive', onPress: clearDone },
                  ])
                }
              />
            ) : filter !== 'faites' && sorted.length > 1 ? (
              <IconBtn icon={reorder ? 'check' : 'move'} label={reorder ? tr('Terminer le réordonnancement') : tr('Réordonner les tâches')} bg={reorder ? t.accentSoft : undefined} onPress={() => setReorder(!reorder)} />
            ) : (
              <Enso size={58} progress={pct} stroke={4}>
                <Txt v="num" style={{ fontSize: 13 }}>
                  {Math.round(pct * 100)}%
                </Txt>
              </Enso>
            )
          }
        />

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip label={tr("Aujourd'hui")} active={filter === 'jour'} onPress={() => setFilter('jour')} />
          <Chip label={tr('À venir')} active={filter === 'avenir'} onPress={() => setFilter('avenir')} />
          <Chip label={tr('Toutes')} active={filter === 'toutes'} onPress={() => setFilter('toutes')} />
          <Chip label={tr('Faites')} active={filter === 'faites'} onPress={() => setFilter('faites')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          <Chip label={tr('Toutes les listes')} active={!list} color={t.bgAlt} onPress={() => setList(null)} />
          {db.settings.lists.map((l) => (
            <Chip key={l} label={`# ${l}`} active={list === l} color={t.bgAlt} onPress={() => setList(list === l ? null : l)} />
          ))}
        </ScrollView>
        {tags.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
            {tags.map(({ tag: name, count }) => (
              <TagChip
                key={name}
                name={name}
                count={count}
                active={activeTag === name}
                onPress={() => setTag(activeTag === name ? null : name)}
                onLongPress={() =>
                  Alert.alert(tr('Retirer #{name} ?', { name }), trn(count, 'Le tag sera retiré de {n} tâche. Les tâches sont gardées.', 'Le tag sera retiré de {n} tâches. Les tâches sont gardées.'), [
                    { text: tr('Annuler'), style: 'cancel' },
                    {
                      text: tr('Retirer'),
                      style: 'destructive',
                      onPress: () => {
                        for (const x of db.tasks) {
                          if (!x.tags?.includes(name)) continue;
                          const rest = x.tags.filter((y) => y !== name);
                          upsertTask({ ...x, tags: rest.length ? rest : undefined });
                        }
                        if (tag === name) setTag(null);
                      },
                    },
                  ])
                }
              />
            ))}
          </ScrollView>
        ) : null}

        {sorted.length === 0 ? (
          <View style={{ marginTop: 20 }}>
            <Empty
              jp={filter === 'faites' ? '空' : '静'}
              title={filter === 'faites' ? tr('Rien de coché pour l’instant.') : tr('Tout est calme.')}
              hint={filter === 'jour' ? tr('Aucune tâche pour aujourd’hui. Profite, ou prends de l’avance.') : tr('Touche + pour ajouter une tâche.')}
            />
          </View>
        ) : (
          groups.map((g) =>
            g.title ? (
              <Section key={g.title} title={`${tr(g.title)} · ${g.items.length}`} style={{ marginTop: 22 }}>
                <TaskList items={g.items} reorder={reorder} onReorder={reorderTasks} />
              </Section>
            ) : (
              <View key="all" style={{ marginTop: 20 }}>
                <TaskList items={g.items} reorder={reorder} onReorder={reorderTasks} />
              </View>
            ),
          )
        )}
        <Txt v="small" color={t.muted} style={{ textAlign: 'center', marginTop: 16, lineHeight: 19 }}>
          {reorder
            ? tr('Appui long sur une tâche puis glisse-la à sa place')
            : tr('Glisse à droite pour cocher, à gauche pour reporter à demain\nAppui long pour supprimer')}
        </Txt>
      </Screen>
      <Fab label={tr('Nouvelle tâche')} onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new', list: list ?? '', due: filter === 'jour' ? today : '' } })} />
    </View>
  );
}

function TaskList({ items, reorder, onReorder }: { items: Task[]; reorder: boolean; onReorder: (ids: string[]) => void }) {
  if (!reorder || items.length < 2) return items.map((x) => <TaskItem key={x.id} task={x} />);
  return <DraggableList items={items} keyOf={(x) => x.id} onReorder={onReorder} render={(x) => <TaskItem task={x} dragging />} />;
}
