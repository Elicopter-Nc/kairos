import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
import { eventsOn } from '../../data/recurrence';
import { DB, Task } from '../../data/types';
import { DAYS_SHORT, MONTHS_SHORT, fromKey, relativeLabel, todayKey } from '../../lib/date';
import { KANJI_DAYS } from '../../theme';

import { BOLD, DARK, LIGHT, layoutOf, MEDIUM, nowHM, Pal, SERIF, Size } from '../palette';
import { tr, trn } from '../../i18n';

export function pickWidgetTasks(db: DB): { pending: Task[]; doneToday: Task[]; total: number } {
  const pending = db.tasks
    .filter((t) => !t.done)
    .sort((a, b) => {
      const da = a.due ?? '9999-99-99';
      const dbb = b.due ?? '9999-99-99';
      if (da !== dbb) return da < dbb ? -1 : 1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return (a.time ?? '99') < (b.time ?? '99') ? -1 : 1;
    });
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const doneToday = db.tasks.filter((t) => t.done && (t.doneAt ?? 0) >= start.getTime()).slice(0, 3);
  return { pending, doneToday, total: pending.length };
}

function Row({ task, p, compact = false }: { task: Task; p: Pal; compact?: boolean }) {
  const today = todayKey();
  const overdue = !task.done && task.due && task.due < today;
  const label = task.due ? `${relativeLabel(task.due)}${task.time ? ' ' + task.time : ''}` : '';
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: compact ? 5 : 7,
        paddingHorizontal: compact ? 0 : 4,
      }}
    >
      <FlexWidget
        clickAction="TOGGLE_TASK"
        clickActionData={{ id: task.id }}
        accessibilityLabel={task.done ? tr('Décocher {title}', { title: task.title }) : tr('Cocher {title}', { title: task.title })}
        style={{
          width: compact ? 18 : 22,
          height: compact ? 18 : 22,
          borderRadius: 6,
          borderWidth: task.done ? 0 : 1,
          borderColor: p.muted,
          backgroundColor: task.done ? p.check : p.chip,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: compact ? 8 : 10,
        }}
      >
        <TextWidget text={task.done ? '✓' : ''} style={{ fontSize: 13, color: p.bg, fontFamily: BOLD }} />
      </FlexWidget>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: `kairos://task/${task.id}` }}
        style={{ flex: 1, flexDirection: 'column' }}
      >
        <TextWidget
          text={task.title}
          maxLines={1}
          truncate="END"
          style={{ fontSize: compact ? 13 : 14.5, fontFamily: MEDIUM, color: task.done ? p.muted : task.priority === 2 ? p.accent : p.ink }}
        />
        {label && !compact ? (
          <TextWidget
            text={label}
            style={{ fontSize: 11, fontFamily: MEDIUM, color: overdue ? p.accent : p.muted, marginTop: 1 }}
          />
        ) : null}
      </FlexWidget>
    </FlexWidget>
  );
}

function Body({ db, p }: { db: DB; p: Pal }) {
  const today = todayKey();
  const d = fromKey(today);
  const { pending, doneToday } = pickWidgetTasks(db);
  const nextEv = eventsOn(db.events, today).find((o) => o.event.allDay || (o.event.start ?? '') >= nowHM());
  const items = [...pending.slice(0, 12), ...doneToday];

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: p.bg,
        borderRadius: 24,
        padding: 16,
        flexDirection: 'column',
      }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://taches' }} style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={`やること · ${KANJI_DAYS[d.getDay()]}曜日`} style={{ fontSize: 11, fontFamily: SERIF, color: p.check, letterSpacing: 0.1 }} />
          <TextWidget text={tr('Tâches')} style={{ fontSize: 26, fontFamily: SERIF, color: p.ink }} />
          <TextWidget
            text={`${DAYS_SHORT[d.getDay()].toUpperCase()} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toUpperCase()} · ` + tr('{n} À FAIRE', { n: pending.length })}
            style={{ fontSize: 10, fontFamily: MEDIUM, color: p.muted, letterSpacing: 0.15 }}
          />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'kairos://task/new' }}
          accessibilityLabel={tr('Nouvelle tâche')}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: p.check,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TextWidget text="+" style={{ fontSize: 22, fontFamily: MEDIUM, color: p.bg }} />
        </FlexWidget>
      </FlexWidget>

      {nextEv ? (
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'kairos://agenda' }}
          style={{
            width: 'match_parent',
            marginTop: 8,
            backgroundColor: p.chip,
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
        >
          <TextWidget
            text={`${nextEv.event.allDay ? tr('Journée') : nextEv.event.start}  ·  ${nextEv.event.title}`}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 12, fontFamily: MEDIUM, color: p.ink }}
          />
        </FlexWidget>
      ) : null}

      <FlexWidget style={{ width: 'match_parent', height: 1, backgroundColor: p.line, marginTop: 10, marginBottom: 2 }} />

      {items.length === 0 ? (
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'kairos://task/new' }}
          style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}
        >
          <TextWidget text={tr('Tout est fait.')} style={{ fontSize: 22, fontFamily: SERIF, color: p.ink }} />
          <TextWidget text={tr('Touchez + pour ajouter une tâche')} style={{ fontSize: 11, fontFamily: MEDIUM, color: p.muted }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {items.map((t) => (
            <Row key={t.id} task={t} p={p} />
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}


/** 2×2 et étroit : compteur + liste courte, sans le bandeau d'événement. */
function Small({ db, p }: { db: DB; p: Pal }) {
  const { pending, doneToday } = pickWidgetTasks(db);
  const items = [...pending.slice(0, 10), ...doneToday];
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 22, padding: 12, flexDirection: 'column' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://taches' }} style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text="やること" style={{ fontSize: 10, fontFamily: SERIF, color: p.check }} />
          <TextWidget text={pending.length ? tr('{n} à faire', { n: pending.length }) : tr('Tâches')} style={{ fontSize: 17, fontFamily: SERIF, color: p.ink }} />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'kairos://task/new' }}
          accessibilityLabel={tr('Nouvelle tâche')}
          style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: p.check, alignItems: 'center', justifyContent: 'center' }}
        >
          <TextWidget text="+" style={{ fontSize: 18, fontFamily: MEDIUM, color: p.bg }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', height: 1, backgroundColor: p.line, marginTop: 6, marginBottom: 2 }} />
      {items.length === 0 ? (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://task/new' }} style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget text={tr('Tout est fait.')} style={{ fontSize: 15, fontFamily: SERIF, color: p.ink }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {items.map((t) => (
            <Row key={t.id} task={t} p={p} compact />
          ))}
        </ListWidget>
      )}
    </FlexWidget>
  );
}

/** Une seule rangée (4×1, 2×1) : la prochaine tâche, cochable, et le compteur. */
function Strip({ db, p }: { db: DB; p: Pal }) {
  const { pending } = pickWidgetTasks(db);
  const next = pending[0];
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 22, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
      {next ? (
        <FlexWidget
          clickAction="TOGGLE_TASK"
          clickActionData={{ id: next.id }}
          accessibilityLabel={tr('Cocher {title}', { title: next.title })}
          style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: p.muted, backgroundColor: p.chip, marginRight: 10 }}
        />
      ) : null}
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: next ? `kairos://task/${next.id}` : 'kairos://taches' }} style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget text={next ? next.title : tr('Tout est fait.')} maxLines={1} truncate="END" style={{ fontSize: 14, fontFamily: next ? MEDIUM : SERIF, color: p.ink }} />
        <TextWidget
          text={pending.length > 1 ? trn(pending.length - 1, '+ {n} autre', '+ {n} autres') : 'やること'}
          style={{ fontSize: 10, fontFamily: pending.length > 1 ? MEDIUM : SERIF, color: p.muted }}
        />
      </FlexWidget>
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: 'kairos://task/new' }}
        accessibilityLabel={tr('Nouvelle tâche')}
        style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: p.check, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
      >
        <TextWidget text="+" style={{ fontSize: 18, fontFamily: MEDIUM, color: p.bg }} />
      </FlexWidget>
    </FlexWidget>
  );
}

export function TasksWidget({ db, size }: { db: DB; size?: Size }) {
  const layout = layoutOf(size);
  const C = layout === 'bande' ? Strip : layout === 'petit' ? Small : Body;
  return { light: <C db={db} p={LIGHT} />, dark: <C db={db} p={DARK} /> };
}
