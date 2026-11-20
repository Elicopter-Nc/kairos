import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
import { eventsBetween, Occurrence } from '../data/recurrence';
import { DB } from '../data/types';
import { addDays, fromKey, MONTHS_SHORT, relativeLabel, todayKey } from '../lib/date';
import { KANJI_DAYS, KANJI_MONTHS } from '../theme';
import { epure, komorebi, seasonParticle, swatchOf } from './art';
import { Frame, PlusBtn } from './Frame';
import { DARK, LIGHT, layoutOf, Look, MEDIUM, nowHM, Pal, SERIF, Size, sizeOr } from './palette';
import { tr } from '../i18n';

// Widget 予定 : le programme du jour, ou des 7 prochains jours si aujourd'hui est vide,
// en ligne du temps (pastille + fil de la couleur de l'événement).

export function pickAgenda(db: DB): { items: Occurrence[]; todayOnly: boolean } {
  const today = todayKey();
  const now = nowHM();
  const todays = eventsBetween(db.events, today, today).filter((o) => o.event.allDay || (o.event.end ?? o.event.start ?? '') >= now);
  if (todays.length) return { items: todays.slice(0, 8), todayOnly: true };
  return { items: eventsBetween(db.events, addDays(today, 1), addDays(today, 7)).slice(0, 8), todayOnly: false };
}

function Line({ o, p, showDay, compact = false, last }: { o: Occurrence; p: Pal; showDay: boolean; compact?: boolean; last: boolean }) {
  const ev = o.event;
  const c = swatchOf(ev.color, p);
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: `kairos://event/${ev.id}?date=${o.date}` }}
      style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}
    >
      <FlexWidget style={{ width: compact ? 44 : 54, flexDirection: 'column', paddingVertical: 6 }}>
        <TextWidget text={ev.allDay ? '終日' : ev.start ?? ''} style={{ fontSize: compact ? 12.5 : 15, fontFamily: SERIF, color: p.ink }} />
        {showDay ? <TextWidget text={relativeLabel(o.date)} maxLines={1} truncate="END" style={{ fontSize: 9, fontFamily: MEDIUM, color: p.muted }} /> : null}
      </FlexWidget>
      {/* ligne du temps : pastille de couleur et fil */}
      <FlexWidget style={{ width: 14, height: compact ? 34 : 44, flexDirection: 'column', alignItems: 'center', marginRight: compact ? 6 : 10 }}>
        <FlexWidget style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c, borderWidth: 2, borderColor: p.bg, marginTop: compact ? 8 : 11 }} />
        {last ? null : <FlexWidget style={{ width: 2, flex: 1, backgroundColor: p.line }} />}
      </FlexWidget>
      <FlexWidget style={{ flex: 1, flexDirection: 'column', paddingVertical: 6 }}>
        <TextWidget text={ev.title} maxLines={1} truncate="END" style={{ fontSize: compact ? 13 : 14.5, fontFamily: MEDIUM, color: p.ink }} />
        {ev.location && !compact ? <TextWidget text={ev.location} maxLines={1} truncate="END" style={{ fontSize: 10.5, fontFamily: MEDIUM, color: p.muted }} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
}

function Plus({ p, size, date, look }: { p: Pal; size: number; date: string; look: Look }) {
  return <PlusBtn p={p} size={look === 'epure' ? Math.round(size * 0.86) : size} look={look} uri={`kairos://event/new?date=${date}`} label={tr('Nouvel événement')} />;
}

const art = (db: DB, s: Size, p: Pal, look: Look) =>
  look === 'epure' ? epure(s, p, 'agenda') : komorebi(s, p, { name: 'agenda', particle: seasonParticle(db.settings.hemisphere) });
const mark = (look: Look) => (look === 'epure' ? undefined : '予');

function Body({ db, p, s, look }: { db: DB; p: Pal; s: Size; look: Look }) {
  const today = todayKey();
  const d = fromKey(today);
  const { items, todayOnly } = pickAgenda(db);
  return (
    <Frame size={s} p={p} art={art(db, s, p, look)} mark={mark(look)} style={{ padding: 14, flexDirection: 'column' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        {/* la date en grand, comme sur l'écran Jour */}
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://agenda' }} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TextWidget text={String(d.getDate())} style={{ fontSize: 40, fontFamily: SERIF, color: p.ink }} />
          <FlexWidget style={{ flexDirection: 'column', marginLeft: 10 }}>
            <TextWidget text={`${KANJI_DAYS[d.getDay()]}曜日 · ${KANJI_MONTHS[d.getMonth()]}`} style={{ fontSize: 10.5, fontFamily: SERIF, color: p.check }} />
            <TextWidget text={todayOnly ? tr('Aujourd’hui') : tr('Cette semaine')} style={{ fontSize: 19, fontFamily: SERIF, color: p.ink }} />
            <TextWidget text={MONTHS_SHORT[d.getMonth()].toUpperCase() + ' · ' + (items.length === 0 ? tr('aucun RENDEZ-VOUS') : items.length === 1 ? tr('1 RENDEZ-VOUS') : tr('{n} RENDEZ-VOUS', { n: items.length }))} style={{ fontSize: 9, fontFamily: MEDIUM, color: p.muted, letterSpacing: 0.15 }} />
          </FlexWidget>
        </FlexWidget>
        <Plus p={p} size={38} date={today} look={look} />
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', height: 1, backgroundColor: p.line, marginTop: 8, marginBottom: 2 }} />
      {items.length === 0 ? (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://agenda' }} style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          {look === 'epure' ? null : <TextWidget text="閑" style={{ fontSize: 24, fontFamily: SERIF, color: p.check }} />}
          <TextWidget text={tr('Agenda libre.')} style={{ fontSize: 18, fontFamily: SERIF, color: p.ink }} />
          <TextWidget text={tr('Rien de prévu cette semaine')} style={{ fontSize: 11, fontFamily: MEDIUM, color: p.muted }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {items.map((o, i) => (
            <Line key={o.event.id + o.date} o={o} p={p} showDay={!todayOnly} last={i === items.length - 1} />
          ))}
        </ListWidget>
      )}
    </Frame>
  );
}

function Small({ db, p, s, look }: { db: DB; p: Pal; s: Size; look: Look }) {
  const today = todayKey();
  const d = fromKey(today);
  const { items, todayOnly } = pickAgenda(db);
  return (
    <Frame size={s} p={p} art={art(db, s, p, look)} mark={mark(look)} style={{ padding: 12, flexDirection: 'column' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://agenda' }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget text={String(d.getDate())} style={{ fontSize: 26, fontFamily: SERIF, color: p.ink }} />
          <FlexWidget style={{ flexDirection: 'column', marginLeft: 6 }}>
            <TextWidget text={`${KANJI_DAYS[d.getDay()]}曜日`} style={{ fontSize: 9.5, fontFamily: SERIF, color: p.check }} />
            <TextWidget text={todayOnly ? tr('Aujourd’hui') : tr('Semaine')} style={{ fontSize: 13, fontFamily: SERIF, color: p.ink }} />
          </FlexWidget>
        </FlexWidget>
        <Plus p={p} size={28} date={today} look={look} />
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', height: 1, backgroundColor: p.line, marginTop: 6, marginBottom: 2 }} />
      {items.length === 0 ? (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://agenda' }} style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          {look === 'epure' ? null : <TextWidget text="閑" style={{ fontSize: 20, fontFamily: SERIF, color: p.check }} />}
          <TextWidget text={tr('Agenda libre.')} style={{ fontSize: 14, fontFamily: SERIF, color: p.ink }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {items.map((o, i) => (
            <Line key={o.event.id + o.date} o={o} p={p} showDay={!todayOnly} compact last={i === items.length - 1} />
          ))}
        </ListWidget>
      )}
    </Frame>
  );
}

/** Une seule rangée : le prochain rendez-vous. */
function Strip({ db, p, s, look }: { db: DB; p: Pal; s: Size; look: Look }) {
  const { items, todayOnly } = pickAgenda(db);
  const o = items[0];
  return (
    <Frame
      size={s}
      p={p}
      art={art(db, s, p, look)}
      mark={mark(look)}
      markSize={Math.round(s.height * 0.8)}
      click={{ clickAction: 'OPEN_URI', clickActionData: { uri: o ? `kairos://event/${o.event.id}?date=${o.date}` : 'kairos://agenda' } }}
      style={{ paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}
    >
      {o ? (
        <>
          <FlexWidget style={{ flexDirection: 'column', marginRight: 10 }}>
            <TextWidget text={o.event.allDay ? '終日' : o.event.start ?? ''} style={{ fontSize: 16, fontFamily: SERIF, color: p.ink }} />
            <TextWidget text={todayOnly ? tr('aujourd’hui') : relativeLabel(o.date)} maxLines={1} style={{ fontSize: 9, fontFamily: MEDIUM, color: p.muted }} />
          </FlexWidget>
          <FlexWidget style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: swatchOf(o.event.color, p), marginRight: 10 }} />
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget text={o.event.title} maxLines={1} truncate="END" style={{ fontSize: 14, fontFamily: MEDIUM, color: p.ink }} />
          </FlexWidget>
        </>
      ) : (
        <>
          <TextWidget text="閑  " style={{ fontSize: 16, fontFamily: SERIF, color: p.check }} />
          <TextWidget text={tr('Agenda libre cette semaine')} maxLines={1} truncate="END" style={{ fontSize: 14, fontFamily: SERIF, color: p.ink }} />
        </>
      )}
    </Frame>
  );
}

export function AgendaWidget({ db, size, look = 'komorebi' }: { db: DB; size?: Size; look?: Look }) {
  const s = sizeOr(size, { width: 320, height: 160 });
  const layout = layoutOf(s);
  const C = layout === 'bande' ? Strip : layout === 'petit' ? Small : Body;
  return { light: <C db={db} p={LIGHT} s={s} look={look} />, dark: <C db={db} p={DARK} s={s} look={look} /> };
}
