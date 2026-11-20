import { useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { BonsaiTree } from '../components/BonsaiTree';
import { close, EditorShell } from '../components/editor';
import { Card, IconBtn, Txt } from '../components/ui';
import { useStore } from '../data/store';
import { capitalize, formatLong, todayKey } from '../lib/date';
import { gardenOf } from '../lib/garden';
import { bonsaiOf } from '../lib/bonsai/tree';
import { tr, trn } from '../i18n';
import { seasonNow, useTheme } from '../theme';

// 盆栽 — le bonsaï de l'année : chaque jour actif fait pousser un rameau, les belles
// journées fleurissent, et le feuillage suit la saison.

export default function Jardin() {
  const t = useTheme();
  const { width, height: screenH } = useWindowDimensions();
  const { db } = useStore();
  const today = todayKey();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [selected, setSelected] = useState<string | null>(null);

  const until = year === thisYear ? today : `${year}-12-31`;
  const tree = useMemo(() => bonsaiOf(db, year, until), [db, year, until]);
  const garden = useMemo(() => gardenOf(db, year), [db, year]);
  const day = selected ? garden.get(selected) : undefined;
  const activeToday = (garden.get(today)?.score ?? 0) > 0;
  const season = seasonNow(db.settings.hemisphere);

  const w = width - 40;
  const h = Math.round(Math.min(w * 1.15, screenH * 0.55));

  return (
    <EditorShell kicker={tr('Le bonsaï de l’année')} jp="盆栽" onSave={close} saveLabel={tr('Fini')} closeLabel={tr('Fermer')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Txt v="title" style={{ flex: 1 }}>
          {year}
        </Txt>
        <IconBtn icon="chevron-left" label={tr('Année précédente')} onPress={() => setYear(year - 1)} size={38} />
        <View style={{ width: 8 }} />
        <IconBtn icon="chevron-right" label={tr('Année suivante')} onPress={() => year < thisYear && setYear(year + 1)} size={38} />
      </View>

      <View style={{ width: w, height: h, borderRadius: 28, overflow: 'hidden', backgroundColor: t.dark ? '#1B2019' : '#ECEDDF' }}>
        <BonsaiTree tree={tree} width={w} height={h} dark={t.dark} season={season} selected={selected ?? ''} falling={year === thisYear && activeToday} onSelect={setSelected} />
      </View>
      <Txt v="small" color={t.muted} style={{ marginTop: 10, textAlign: 'center' }}>
        {tr('Touche l’arbre pour le faire frémir, ou un feuillage pour revoir sa journée.')}
      </Txt>

      <Card radius={20} style={{ marginTop: 14 }} contentStyle={{ padding: 16, gap: 4 }}>
        {selected ? (
          <>
            <Txt v="kicker" color={t.muted}>
              {capitalize(formatLong(selected))}
            </Txt>
            <Txt v="body">
              {day && day.score > 0
                ? [
                    day.tasks ? trn(day.tasks, '{n} tâche faite', '{n} tâches faites') : '',
                    day.focus ? tr('{n} min de focus', { n: day.focus }) : '',
                    day.rituals ? trn(day.rituals, '{n} rituel', '{n} rituels') : '',
                    day.journal ? tr('journal écrit') : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : tr('Un jour de repos.')}
            </Txt>
          </>
        ) : (
          <Txt v="body" color={t.inkSoft}>
            {tree.active
              ? tr('Chaque jour actif fait pousser un rameau. Les belles journées se couvrent de fleurs, et le feuillage suit la saison : sakura, vert profond, érable, neige.')
              : tr('L’arbre attend son premier rameau. Coche une tâche, lance un focus ou écris ton journal : il commencera à pousser.')}
          </Txt>
        )}
      </Card>

      <View style={{ flexDirection: 'row', marginTop: 18 }}>
        <Stat n={tree.active} label={tr('jours actifs')} />
        <Stat n={tree.visible} label={tr('rameaux')} />
        <Stat n={tree.bloomDays} label={tr('belles journées')} />
      </View>
    </EditorShell>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Txt v="num" style={{ fontSize: 20 }}>
        {n}
      </Txt>
      <Txt v="small" color={t.muted} style={{ fontSize: 11, lineHeight: 14, textAlign: 'center' }}>
        {label}
      </Txt>
    </View>
  );
}
