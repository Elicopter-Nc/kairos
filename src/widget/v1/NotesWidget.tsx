import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
import { DB, Note } from '../../data/types';
import { SWATCHES } from '../../theme';
import { DARK, LIGHT, layoutOf, MEDIUM, Pal, SERIF, Size } from '../palette';
import { tr } from '../../i18n';

// Widget 覚書 : les notes épinglées d'abord, puis les plus récentes.

export function pickNotes(db: DB): Note[] {
  return [...db.notes].sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.updatedAt - a.updatedAt));
}

/** Aperçu du texte sur une ligne : sans cases à cocher ni retours à la ligne. */
export function excerpt(body: string): string {
  return body
    .split('\n')
    .map((l) => l.replace(/^\s*[-*]\s*\[[ xX]\]\s*/, '').replace(/^\s*[-*#>]+\s*/, '').trim())
    .filter(Boolean)
    .join(' · ');
}

const title = (n: Note) => n.title.trim() || excerpt(n.body).slice(0, 40) || tr('Sans titre');
const swatch = (n: Note, p: Pal) => ((p === DARK ? SWATCHES[n.color].nuit : SWATCHES[n.color].jour) as `#${string}`);

function Plus({ p, size = 30 }: { p: Pal; size?: number }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'kairos://note/new' }}
      accessibilityLabel={tr('Nouvelle note')}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.check, alignItems: 'center', justifyContent: 'center' }}
    >
      <TextWidget text="+" style={{ fontSize: size * 0.55, fontFamily: MEDIUM, color: p.bg }} />
    </FlexWidget>
  );
}

function Line({ n, p }: { n: Note; p: Pal }) {
  const ex = excerpt(n.body);
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: `kairos://note/${n.id}` }}
      style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
    >
      <FlexWidget style={{ width: 4, height: 30, borderRadius: 2, backgroundColor: swatch(n, p), marginRight: 10 }} />
      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget text={(n.pinned ? '◆ ' : '') + title(n)} maxLines={1} truncate="END" style={{ fontSize: 14, fontFamily: SERIF, color: p.ink }} />
        {ex && n.title.trim() ? <TextWidget text={ex} maxLines={1} truncate="END" style={{ fontSize: 11, fontFamily: MEDIUM, color: p.muted }} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
}

function Body({ db, p }: { db: DB; p: Pal }) {
  const notes = pickNotes(db).slice(0, 15);
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 22, padding: 14, flexDirection: 'column' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://notes' }} style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text="覚書" style={{ fontSize: 11, fontFamily: SERIF, color: p.check }} />
          <TextWidget text={tr('Notes')} style={{ fontSize: 22, fontFamily: SERIF, color: p.ink }} />
        </FlexWidget>
        <Plus p={p} size={38} />
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', height: 1, backgroundColor: p.line, marginTop: 8, marginBottom: 2 }} />
      {notes.length === 0 ? (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://note/new' }} style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget text={tr('Page blanche.')} style={{ fontSize: 18, fontFamily: SERIF, color: p.ink }} />
          <TextWidget text={tr('Touchez + pour écrire')} style={{ fontSize: 11, fontFamily: MEDIUM, color: p.muted }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {notes.map((n) => (
            <Line key={n.id} n={n} p={p} />
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}

/** 2×2 : une seule note (épinglée ou la dernière), comme un papier posé sur l'écran. */
function Small({ db, p }: { db: DB; p: Pal }) {
  const n = pickNotes(db)[0];
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 22, padding: 12, flexDirection: 'column' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ width: 4, height: 14, borderRadius: 2, backgroundColor: n ? swatch(n, p) : p.line, marginRight: 6 }} />
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://notes' }} style={{ flex: 1 }}>
          <TextWidget text="覚書" style={{ fontSize: 10, fontFamily: SERIF, color: p.check }} />
        </FlexWidget>
        <Plus p={p} size={26} />
      </FlexWidget>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: n ? `kairos://note/${n.id}` : 'kairos://note/new' }}
        style={{ flex: 1, width: 'match_parent', flexDirection: 'column', marginTop: 6 }}
      >
        <TextWidget text={n ? title(n) : tr('Page blanche.')} maxLines={2} truncate="END" style={{ fontSize: 16, fontFamily: SERIF, color: p.ink }} />
        <TextWidget text={n ? excerpt(n.body) : tr('Touchez + pour écrire')} maxLines={5} truncate="END" style={{ fontSize: 11.5, fontFamily: MEDIUM, color: p.muted, marginTop: 3 }} />
      </FlexWidget>
    </FlexWidget>
  );
}

function Strip({ db, p }: { db: DB; p: Pal }) {
  const n = pickNotes(db)[0];
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 22, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: n ? `kairos://note/${n.id}` : 'kairos://notes' }}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
      >
        <FlexWidget style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: n ? swatch(n, p) : p.line, marginRight: 10 }} />
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={n ? title(n) : tr('Page blanche.')} maxLines={1} truncate="END" style={{ fontSize: 14, fontFamily: SERIF, color: p.ink }} />
          <TextWidget text={n ? excerpt(n.body) || '覚書' : '覚書'} maxLines={1} truncate="END" style={{ fontSize: 10.5, fontFamily: MEDIUM, color: p.muted }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ width: 8 }} />
      <Plus p={p} />
    </FlexWidget>
  );
}

export function NotesWidget({ db, size }: { db: DB; size?: Size }) {
  const layout = layoutOf(size);
  const C = layout === 'bande' ? Strip : layout === 'petit' ? Small : Body;
  return { light: <C db={db} p={LIGHT} />, dark: <C db={db} p={DARK} /> };
}
