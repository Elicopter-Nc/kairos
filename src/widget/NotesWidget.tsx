import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
import { DB, Note } from '../data/types';
import { epure, komorebi, paperArt, seasonParticle, swatchOf } from './art';
import { Frame, PlusBtn } from './Frame';
import { DARK, LIGHT, layoutOf, Look, MEDIUM, Pal, SERIF, Size, sizeOr } from './palette';
import { tr, trn } from '../i18n';

// Widget 覚書 : les notes épinglées d'abord, puis les plus récentes,
// sur un papier réglé avec un ruban washi de la couleur de la note.

export function pickNotes(db: DB): Note[] {
  return [...db.notes].sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.updatedAt - a.updatedAt));
}

const CHECK = /^\s*[-*]\s*\[([ xX])\]\s*/;

/** Aperçu du texte sur une ligne : cases à cocher rendues en ☐ / ☑. */
export function excerpt(body: string): string {
  return body
    .split('\n')
    .map((l) => {
      const m = l.match(CHECK);
      if (m) return (m[1] === ' ' ? '□ ' : '☑ ') + l.replace(CHECK, '').trim();
      return l.replace(/^\s*[-*#>]+\s*/, '').trim();
    })
    .filter(Boolean)
    .join('  ·  ');
}

/** Les lignes de la note, une par ligne (pour le petit format). */
function lines(body: string, max: number): string[] {
  return excerpt(body).split('  ·  ').slice(0, max);
}

const title = (n: Note) => n.title.trim() || lines(n.body, 1)[0]?.slice(0, 40) || tr('Sans titre');
/** Ruban washi : couleur de la note (le Sumi est trop sombre / clair, on prend la Sauge). */
const tape = (n: Note | undefined, p: Pal) => swatchOf(!n || n.color === 'encre' ? 'menthe' : n.color, p);

function Plus({ p, size = 30, look }: { p: Pal; size?: number; look: Look }) {
  return <PlusBtn p={p} size={look === 'epure' ? Math.round(size * 0.86) : size} look={look} uri="kairos://note/new" label={tr('Nouvelle note')} />;
}
const mark = (look: Look) => (look === 'epure' ? undefined : '書');

function Line({ n, p }: { n: Note; p: Pal }) {
  const ex = excerpt(n.body);
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: `kairos://note/${n.id}` }}
      style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}
    >
      {/* onglet de couleur, comme un marque-page */}
      <FlexWidget style={{ width: 6, height: 32, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: swatchOf(n.color, p), marginRight: 10 }} />
      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget text={(n.pinned ? '◆ ' : '') + title(n)} maxLines={1} truncate="END" style={{ fontSize: 14.5, fontFamily: SERIF, color: p.ink }} />
        {ex && n.title.trim() ? <TextWidget text={ex} maxLines={1} truncate="END" style={{ fontSize: 11, fontFamily: MEDIUM, color: p.muted }} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
}

function Body({ db, p, s, look }: { db: DB; p: Pal; s: Size; look: Look }) {
  const notes = pickNotes(db).slice(0, 15);
  const art = look === 'epure' ? epure(s, p, 'notes') : komorebi(s, p, { name: 'notes', leaves: false, particle: seasonParticle(db.settings.hemisphere), extra: paperArt(s.width, s.height, p, tape(notes[0], p), 78) });
  return (
    <Frame size={s} p={p} art={art} mark={mark(look)} style={{ padding: 14, paddingTop: 18, flexDirection: 'column' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://notes' }} style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={'覚書 · ' + trn(notes.length, '{n} note', '{n} notes')} style={{ fontSize: 11, fontFamily: SERIF, color: p.check }} />
          <TextWidget text={tr('Notes')} style={{ fontSize: 24, fontFamily: SERIF, color: p.ink }} />
        </FlexWidget>
        <Plus p={p} size={38} look={look} />
      </FlexWidget>
      {notes.length === 0 ? (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://note/new' }} style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          {look === 'epure' ? null : <TextWidget text="白" style={{ fontSize: 24, fontFamily: SERIF, color: p.check }} />}
          <TextWidget text={tr('Page blanche.')} style={{ fontSize: 18, fontFamily: SERIF, color: p.ink }} />
          <TextWidget text={tr('Touche + pour écrire')} style={{ fontSize: 11, fontFamily: MEDIUM, color: p.muted }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent', marginTop: 6 }}>
          {notes.map((n) => (
            <Line key={n.id} n={n} p={p} />
          ))}
        </ListWidget>
      )}
    </Frame>
  );
}

/** 2×2 : une seule note (épinglée ou la dernière), comme un papier posé sur l'écran. */
function Small({ db, p, s, look }: { db: DB; p: Pal; s: Size; look: Look }) {
  const n = pickNotes(db)[0];
  const art = look === 'epure' ? epure(s, p, 'notes') : komorebi(s, p, { name: 'notes', leaves: false, extra: paperArt(s.width, s.height, p, tape(n, p), 66) });
  const max = Math.max(2, Math.floor((s.height - 86) / 24));
  return (
    <Frame
      size={s}
      p={p}
      art={art}
      mark={mark(look)}
      click={{ clickAction: 'OPEN_URI', clickActionData: { uri: n ? `kairos://note/${n.id}` : 'kairos://note/new' } }}
      style={{ padding: 12, paddingTop: 16, flexDirection: 'column' }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'flex-start' }}>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={n?.pinned ? '覚書 · ' + tr('épinglée') : '覚書'} style={{ fontSize: 9.5, fontFamily: SERIF, color: p.check }} />
          <TextWidget text={n ? title(n) : tr('Page blanche.')} maxLines={2} truncate="END" style={{ fontSize: 16, fontFamily: SERIF, color: p.ink }} />
        </FlexWidget>
        <Plus p={p} size={26} look={look} />
      </FlexWidget>
      {/* le texte posé sur les lignes du papier */}
      <FlexWidget style={{ flexDirection: 'column', marginTop: 4 }}>
        {(n ? lines(n.body, max) : [tr('Touche + pour écrire')]).map((l, i) => (
          <FlexWidget key={i} style={{ height: 24, justifyContent: 'flex-end' }}>
            <TextWidget text={l} maxLines={1} truncate="END" style={{ fontSize: 12, fontFamily: MEDIUM, color: p.muted }} />
          </FlexWidget>
        ))}
      </FlexWidget>
    </Frame>
  );
}

function Strip({ db, p, s, look }: { db: DB; p: Pal; s: Size; look: Look }) {
  const n = pickNotes(db)[0];
  const art = look === 'epure' ? epure(s, p, 'notes') : komorebi(s, p, { name: 'notes', leaves: false, particle: seasonParticle(db.settings.hemisphere) });
  return (
    <Frame size={s} p={p} art={art} mark={mark(look)} markSize={Math.round(s.height * 0.8)} style={{ paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: n ? `kairos://note/${n.id}` : 'kairos://notes' }}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
      >
        <FlexWidget style={{ width: 6, height: 30, borderRadius: 3, backgroundColor: tape(n, p), marginRight: 10 }} />
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={n ? title(n) : tr('Page blanche.')} maxLines={1} truncate="END" style={{ fontSize: 14.5, fontFamily: SERIF, color: p.ink }} />
          <TextWidget text={n ? excerpt(n.body) || '覚書' : '覚書'} maxLines={1} truncate="END" style={{ fontSize: 10.5, fontFamily: MEDIUM, color: p.muted }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ width: 8 }} />
      <Plus p={p} look={look} />
    </Frame>
  );
}

export function NotesWidget({ db, size, look = 'komorebi' }: { db: DB; size?: Size; look?: Look }) {
  const s = sizeOr(size, { width: 170, height: 170 });
  const layout = layoutOf(s);
  const C = layout === 'bande' ? Strip : layout === 'petit' ? Small : Body;
  return { light: <C db={db} p={LIGHT} s={s} look={look} />, dark: <C db={db} p={DARK} s={s} look={look} /> };
}
