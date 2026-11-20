import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
import { eventsBetween, Occurrence } from '../../data/recurrence';
import { DB } from '../../data/types';
import { addDays, fromKey, relativeLabel, todayKey } from '../../lib/date';
import { KANJI_DAYS } from '../../theme';
import { DARK, LIGHT, layoutOf, MEDIUM, nowHM, Pal, SERIF, Size } from '../palette';
import { tr } from '../../i18n';

// Widget 4×2 : le programme du jour, ou des 7 prochains jours si aujourd'hui est vide.

export function pickAgenda(db: DB): { items: Occurrence[]; todayOnly: boolean } {
  const today = todayKey();
  const now = nowHM();
  const todays = eventsBetween(db.events, today, today).filter((o) => o.event.allDay || (o.event.end ?? o.event.start ?? '') >= now);
  if (todays.length) return { items: todays.slice(0, 8), todayOnly: true };
  return { items: eventsBetween(db.events, addDays(today, 1), addDays(today, 7)).slice(0, 8), todayOnly: false };
}

function Line({ o, p, showDay, compact = false }: { o: Occurrence; p: Pal; showDay: boolean; compact?: boolean }) {
  const ev = o.event;
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: `kairos://event/${ev.id}?date=${o.date}` }}
      style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
    >
      <FlexWidget style={{ width: compact ? 42 : 52, flexDirection: 'column' }}>
        <TextWidget text={ev.allDay ? '終日' : ev.start ?? ''} style={{ fontSize: compact ? 12 : 14, fontFamily: SERIF, color: p.check }} />
        {showDay ? <TextWidget text={relativeLabel(o.date)} maxLines={1} truncate="END" style={{ fontSize: 9, fontFamily: MEDIUM, color: p.muted }} /> : null}
      </FlexWidget>
      <FlexWidget style={{ width: 3, height: compact ? 22 : 26, borderRadius: 2, backgroundColor: p.line, marginRight: compact ? 7 : 10 }} />
      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget text={ev.title} maxLines={1} truncate="END" style={{ fontSize: compact ? 13 : 14, fontFamily: MEDIUM, color: p.ink }} />
        {ev.location && !compact ? <TextWidget text={ev.location} maxLines={1} truncate="END" style={{ fontSize: 10.5, fontFamily: MEDIUM, color: p.muted }} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
}

function Body({ db, p }: { db: DB; p: Pal }) {
  const today = todayKey();
  const d = fromKey(today);
  const { items, todayOnly } = pickAgenda(db);
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 24, padding: 14, flexDirection: 'column' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://agenda' }} style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={`予定 · ${KANJI_DAYS[d.getDay()]}曜日`} style={{ fontSize: 11, fontFamily: SERIF, color: p.check }} />
          <TextWidget text={todayOnly ? tr('Aujourd’hui') : tr('Cette semaine')} style={{ fontSize: 22, fontFamily: SERIF, color: p.ink }} />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: `kairos://event/new?date=${today}` }}
          accessibilityLabel={tr('Nouvel événement')}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: p.check, alignItems: 'center', justifyContent: 'center' }}
        >
          <TextWidget text="+" style={{ fontSize: 22, fontFamily: MEDIUM, color: p.bg }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', height: 1, backgroundColor: p.line, marginTop: 8, marginBottom: 2 }} />
      {items.length === 0 ? (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://agenda' }} style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget text={tr('Agenda libre.')} style={{ fontSize: 18, fontFamily: SERIF, color: p.ink }} />
          <TextWidget text={tr('Rien de prévu cette semaine')} style={{ fontSize: 11, fontFamily: MEDIUM, color: p.muted }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {items.map((o) => (
            <Line key={o.event.id + o.date} o={o} p={p} showDay={!todayOnly} />
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}

function Small({ db, p }: { db: DB; p: Pal }) {
  const today = todayKey();
  const { items, todayOnly } = pickAgenda(db);
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 22, padding: 12, flexDirection: 'column' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://agenda' }} style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text="予定" style={{ fontSize: 10, fontFamily: SERIF, color: p.check }} />
          <TextWidget text={todayOnly ? tr('Aujourd’hui') : tr('Semaine')} style={{ fontSize: 17, fontFamily: SERIF, color: p.ink }} />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: `kairos://event/new?date=${today}` }}
          accessibilityLabel={tr('Nouvel événement')}
          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: p.check, alignItems: 'center', justifyContent: 'center' }}
        >
          <TextWidget text="+" style={{ fontSize: 18, fontFamily: MEDIUM, color: p.bg }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', height: 1, backgroundColor: p.line, marginTop: 6, marginBottom: 2 }} />
      {items.length === 0 ? (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://agenda' }} style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget text={tr('Agenda libre.')} style={{ fontSize: 15, fontFamily: SERIF, color: p.ink }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {items.map((o) => (
            <Line key={o.event.id + o.date} o={o} p={p} showDay={!todayOnly} compact />
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}

/** Une seule rangée : le prochain rendez-vous. */
function Strip({ db, p }: { db: DB; p: Pal }) {
  const { items, todayOnly } = pickAgenda(db);
  const o = items[0];
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: o ? `kairos://event/${o.event.id}?date=${o.date}` : 'kairos://agenda' }}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 22, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}
    >
      {o ? (
        <>
          <FlexWidget style={{ flexDirection: 'column', marginRight: 10 }}>
            <TextWidget text={o.event.allDay ? '終日' : o.event.start ?? ''} style={{ fontSize: 15, fontFamily: SERIF, color: p.check }} />
            <TextWidget text={todayOnly ? tr('aujourd’hui') : relativeLabel(o.date)} maxLines={1} style={{ fontSize: 9, fontFamily: MEDIUM, color: p.muted }} />
          </FlexWidget>
          <FlexWidget style={{ width: 3, height: 24, borderRadius: 2, backgroundColor: p.line, marginRight: 10 }} />
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget text={o.event.title} maxLines={1} truncate="END" style={{ fontSize: 14, fontFamily: MEDIUM, color: p.ink }} />
          </FlexWidget>
        </>
      ) : (
        <>
          <TextWidget text="予定  " style={{ fontSize: 13, fontFamily: SERIF, color: p.check }} />
          <TextWidget text={tr('Agenda libre cette semaine')} maxLines={1} truncate="END" style={{ fontSize: 14, fontFamily: SERIF, color: p.ink }} />
        </>
      )}
    </FlexWidget>
  );
}

export function AgendaWidget({ db, size }: { db: DB; size?: Size }) {
  const layout = layoutOf(size);
  const C = layout === 'bande' ? Strip : layout === 'petit' ? Small : Body;
  return { light: <C db={db} p={LIGHT} />, dark: <C db={db} p={DARK} /> };
}
