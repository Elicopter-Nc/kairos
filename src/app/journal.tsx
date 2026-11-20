import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { close, EditorShell } from '../components/editor';
import { JournalBook } from '../components/JournalBook';
import { Chip, IconBtn, tap, Txt } from '../components/ui';
import { useStore } from '../data/store';
import { bookPages } from '../lib/book/pages';
import { capitalize, DAYS_MIN, formatLong, fromKey, monthGrid, MONTHS, todayKey } from '../lib/date';
import { MOODS, moodOf } from '../lib/journal';
import { tr } from '../i18n';
import { KANJI_MONTHS, useTheme } from '../theme';

// 日記 — le journal du mois : chaque jour prend la couleur de son ciel.

function MonthView({ onOpen }: { onOpen: (date: string) => void }) {
  const t = useTheme();
  const { db } = useStore();
  const today = todayKey();
  const [ym, setYm] = useState(() => ({ y: fromKey(today).getFullYear(), m: fromKey(today).getMonth() }));
  const [sel, setSel] = useState<string>(today);
  const days = monthGrid(ym.y, ym.m);
  const byDate = new Map(db.journal.map((j) => [j.date, j]));
  const inMonth = db.journal.filter((j) => fromKey(j.date).getFullYear() === ym.y && fromKey(j.date).getMonth() === ym.m);
  const counts = MOODS.map((m) => ({ ...m, n: inMonth.filter((j) => j.mood === m.id).length }));
  const shift = (d: number) => setYm(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));
  const chosen = byDate.get(sel);
  const chosenMood = moodOf(chosen?.mood);

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Txt v="title">{capitalize(MONTHS[ym.m])}</Txt>
          <Txt v="jp" color={t.muted} style={{ fontSize: 12 }}>
            {ym.y} · {KANJI_MONTHS[ym.m]}
          </Txt>
        </View>
        <IconBtn icon="chevron-left" label={tr('Mois précédent')} onPress={() => shift(-1)} size={38} />
        <View style={{ width: 8 }} />
        <IconBtn icon="chevron-right" label={tr('Mois suivant')} onPress={() => shift(1)} size={38} />
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {DAYS_MIN.map((d, i) => (
          <Txt key={i} v="small" color={t.muted} style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
            {d}
          </Txt>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((k) => {
          const d = fromKey(k);
          const out = d.getMonth() !== ym.m;
          const e = byDate.get(k);
          const mood = moodOf(e?.mood);
          const isSel = k === sel;
          return (
            <Pressable key={k} onPress={() => setSel(k)} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }} accessibilityLabel={`${formatLong(k)}${mood ? ', ' + tr(mood.label) : ''}`}>
              <View
                style={{
                  flex: 1,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: mood ? t.swatch(mood.swatch) : 'transparent',
                  borderWidth: isSel ? 1.5 : k === today ? 1 : 0,
                  borderColor: isSel ? t.accent : t.line,
                  opacity: out ? 0.3 : 1,
                }}
              >
                {mood ? (
                  <Txt v="jp" color={t.onSwatch(mood.swatch)} style={{ fontSize: 15, letterSpacing: 0 }}>
                    {mood.kanji}
                  </Txt>
                ) : (
                  <Txt v="num" color={t.inkSoft} style={{ fontSize: 13 }}>
                    {d.getDate()}
                  </Txt>
                )}
                {e?.text ? <View style={{ position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: mood ? t.onSwatch(mood.swatch) : t.accent }} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* le jour choisi */}
      <View style={{ marginTop: 16, padding: 16, borderRadius: 20, backgroundColor: chosenMood ? t.swatch(chosenMood.swatch) : t.bgAlt }}>
        <Txt v="kicker" color={chosenMood ? t.onSwatch(chosenMood.swatch) : t.muted}>
          {capitalize(formatLong(sel))}
          {chosenMood ? ` · ${tr(chosenMood.label)}` : ''}
        </Txt>
        <Txt v="body" color={chosenMood ? t.onSwatch(chosenMood.swatch) : t.inkSoft} style={{ fontFamily: t.font.mincho, fontSize: 17, lineHeight: 25, marginTop: 6 }}>
          {chosen?.text || (sel === today ? tr('Rien d’écrit pour l’instant. Ça se passe sur l’écran Jour.') : tr('Rien d’écrit ce jour-là.'))}
        </Txt>
      </View>

      {sel <= today ? (
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <Chip label={tr('Ouvrir cette page dans le livre')} icon="book-open" onPress={() => onOpen(sel)} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {counts.map((c) => (
          <Chip key={c.id} label={`${c.kanji}  ${tr(c.label)} · ${c.n}`} />
        ))}
      </View>
    </>
  );
}

/** 日記 — le journal : un livre dont on tourne les pages, ou la vue du mois. */
export default function Journal() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const { db, setJournal } = useStore();
  const pages = useMemo(() => bookPages(db), [db]);
  const [view, setView] = useState<'livre' | 'mois'>('livre');
  const [index, setIndex] = useState(() => Math.max(0, pages.length - 1)); // ouvert à aujourd'hui
  const i = Math.min(index, pages.length - 1);
  const page = pages[i];
  const [draft, setDraft] = useState<{ date: string; text: string } | null>(null);
  const editing = draft && draft.date === page?.date ? draft.text : page?.entry?.text ?? '';

  const w = width - 40;
  const h = Math.round(w * 1.38);

  return (
    <EditorShell kicker={tr('Journal')} jp="日記" onSave={close} saveLabel={tr('Fini')} closeLabel={tr('Fermer')}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <Chip label={tr('Le livre')} icon="book-open" active={view === 'livre'} onPress={() => setView('livre')} />
        <Chip label={tr('Le mois')} icon="calendar" active={view === 'mois'} onPress={() => setView('mois')} />
      </View>

      {view === 'mois' ? (
        <MonthView
          onOpen={(date) => {
            const k = pages.findIndex((p) => p.date === date);
            setIndex(k >= 0 ? k : 0);
            setView('livre');
          }}
        />
      ) : page ? (
        <>
          <JournalBook pages={pages} index={i} onIndex={setIndex} width={w} height={h} hemisphere={db.settings.hemisphere} />

          {/* écrire sur la page ouverte */}
          <Txt v="kicker" color={t.muted} style={{ marginTop: 18, marginBottom: 8 }}>
            {capitalize(formatLong(page.date))}
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {MOODS.map((m) => {
              const active = page.entry?.mood === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    tap();
                    setJournal(page.date, { mood: active ? undefined : m.id });
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={tr(m.label)}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: active ? 'transparent' : t.line, backgroundColor: active ? t.swatch(m.swatch) : 'transparent' }}
                >
                  <Txt v="jp" color={active ? t.onSwatch(m.swatch) : t.accent} style={{ fontSize: 20, letterSpacing: 0 }}>
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
            value={editing}
            onChangeText={(text) => setDraft({ date: page.date, text })}
            onEndEditing={() => {
              if (draft && draft.date === page.date) setJournal(page.date, { text: draft.text.trim() || undefined });
              setDraft(null);
            }}
            placeholder={tr('Écris sur cette page…')}
            placeholderTextColor={t.muted}
            selectionColor={t.selection}
            cursorColor={t.accent}
            selectionHandleColor={t.accent}
            multiline
            maxLength={600}
            style={{ marginTop: 10, minHeight: 80, fontFamily: t.font.mincho, fontSize: 16, lineHeight: 24, color: t.ink, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, backgroundColor: t.card, textAlignVertical: 'top' }}
          />
        </>
      ) : null}
    </EditorShell>
  );
}
