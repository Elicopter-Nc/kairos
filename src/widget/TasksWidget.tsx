import { FlexWidget, ListWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { eventsOn } from '../data/recurrence';
import { DB, Task } from '../data/types';
import { DAYS_SHORT, MONTHS_SHORT, fromKey, relativeLabel, todayKey } from '../lib/date';
import { KANJI_DAYS } from '../theme';
import { brushBar, epure, komorebi, seasonParticle } from './art';
import { Frame, PlusBtn, ThinBar } from './Frame';
import { BOLD, DARK, LIGHT, layoutOf, Look, MEDIUM, nowHM, Pal, SERIF, Size, sizeOr } from './palette';
import { tr, trn } from '../i18n';

// Widget やること : les tâches, cochables depuis l'écran d'accueil.

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

/** Avancement du jour : tâches faites aujourd'hui / (faites + prévues jusqu'à aujourd'hui). */
function dayProgress(db: DB) {
  const today = todayKey();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const done = db.tasks.filter((t) => t.done && (t.doneAt ?? 0) >= start.getTime()).length;
  const due = db.tasks.filter((t) => !t.done && t.due && t.due <= today).length;
  return { done, total: done + due };
}

/** Case ronde comme un petit enso : vide, ou pleine avec la coche. */
function Check({ task, p, size }: { task: Task; p: Pal; size: number }) {
  const urgent = task.priority === 2 && !task.done;
  return (
    <FlexWidget
      clickAction="TOGGLE_TASK"
      clickActionData={{ id: task.id }}
      accessibilityLabel={task.done ? tr('Décocher {title}', { title: task.title }) : tr('Cocher {title}', { title: task.title })}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: task.done ? 0 : 1.5,
        borderColor: urgent ? p.accent : p.check,
        backgroundColor: task.done ? p.check : 'rgba(0, 0, 0, 0)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
      }}
    >
      <TextWidget text={task.done ? '✓' : ''} style={{ fontSize: size * 0.58, color: p.bg, fontFamily: BOLD }} />
    </FlexWidget>
  );
}

function Row({ task, p, compact = false }: { task: Task; p: Pal; compact?: boolean }) {
  const today = todayKey();
  const overdue = !task.done && task.due && task.due < today;
  const label = task.due ? `${relativeLabel(task.due)}${task.time ? ' · ' + task.time : ''}` : '';
  const list = task.list ? `  #${task.list}` : '';
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', paddingVertical: compact ? 5 : 6 }}>
      <Check task={task} p={p} size={compact ? 18 : 21} />
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: `kairos://task/${task.id}` }} style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget
          text={task.title}
          maxLines={1}
          truncate="END"
          style={{ fontSize: compact ? 13 : 14.5, fontFamily: MEDIUM, color: task.done ? p.muted : p.ink }}
        />
        {label && !compact ? (
          <TextWidget text={label + list} maxLines={1} truncate="END" style={{ fontSize: 10.5, fontFamily: MEDIUM, color: overdue ? p.accent : p.muted, marginTop: 1 }} />
        ) : null}
      </FlexWidget>
      {task.priority === 2 && !task.done ? <TextWidget text="!" style={{ fontSize: 14, fontFamily: SERIF, color: p.accent, marginLeft: 6 }} /> : null}
    </FlexWidget>
  );
}

function Plus({ p, size, look }: { p: Pal; size: number; look: Look }) {
  return <PlusBtn p={p} size={size} look={look} uri="kairos://task/new" label={tr('Nouvelle tâche')} />;
}

function art(db: DB, s: Size, p: Pal, look: Look) {
  return look === 'epure' ? epure(s, p, 'taches') : komorebi(s, p, { name: 'taches', particle: seasonParticle(db.settings.hemisphere) });
}
const mark = (look: Look) => (look === 'epure' ? undefined : '事');

/** Avancement : trait de pinceau (Komorebi) ou fine ligne (Épuré). */
function Progress({ p, width, frac, look, h }: { p: Pal; width: number; frac: number; look: Look; h: number }) {
  if (look === 'epure') return <ThinBar p={p} width={width} frac={frac} />;
  return <SvgWidget svg={brushBar(width, h, frac, p)} style={{ width, height: h }} />;
}

function Body({ db, p, s, look }: { db: DB; p: Pal; s: Size; look: Look }) {
  const today = todayKey();
  const d = fromKey(today);
  const { pending, doneToday } = pickWidgetTasks(db);
  const prog = dayProgress(db);
  const nextEv = eventsOn(db.events, today).find((o) => o.event.allDay || (o.event.start ?? '') >= nowHM());
  const items = [...pending.slice(0, 12), ...doneToday];
  const barW = s.width - 32;

  return (
    <Frame size={s} p={p} art={art(db, s, p, look)} mark={mark(look)} style={{ padding: 16, flexDirection: 'column' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://taches' }} style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={`やること · ${KANJI_DAYS[d.getDay()]}曜日`} style={{ fontSize: 11, fontFamily: SERIF, color: p.check }} />
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <TextWidget text={tr('Tâches')} style={{ fontSize: 26, fontFamily: SERIF, color: p.ink }} />
            <TextWidget text={`  ${pending.length}`} style={{ fontSize: 15, fontFamily: SERIF, color: p.check, marginBottom: 4 }} />
          </FlexWidget>
          <TextWidget
            text={`${DAYS_SHORT[d.getDay()].toUpperCase()} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toUpperCase()}${prog.total ? ' · ' + tr('{done} SUR {total} FAITES', { done: prog.done, total: prog.total }) : ''}`}
            style={{ fontSize: 9.5, fontFamily: MEDIUM, color: p.muted, letterSpacing: 0.15 }}
          />
        </FlexWidget>
        <Plus p={p} size={look === 'epure' ? 34 : 40} look={look} />
      </FlexWidget>

      {/* trait de pinceau : l'avancement du jour */}
      <FlexWidget style={{ marginTop: look === 'epure' ? 10 : 8, marginBottom: look === 'epure' ? 4 : 0 }}>
        <Progress p={p} width={barW} frac={prog.total ? prog.done / prog.total : 0} look={look} h={9} />
      </FlexWidget>

      {nextEv ? (
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'kairos://agenda' }}
          style={
            look === 'epure'
              ? { width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingVertical: 3 }
              : { width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: p.chip, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }
          }
        >
          <TextWidget text="予  " style={{ fontSize: 11, fontFamily: SERIF, color: p.check }} />
          <TextWidget
            text={`${nextEv.event.allDay ? tr('Journée') : nextEv.event.start}  ·  ${nextEv.event.title}`}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 12, fontFamily: MEDIUM, color: p.ink }}
          />
        </FlexWidget>
      ) : null}

      {items.length === 0 ? (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://task/new' }} style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          {look === 'epure' ? null : <TextWidget text="空" style={{ fontSize: 26, fontFamily: SERIF, color: p.check }} />}
          <TextWidget text={tr('Table rase.')} style={{ fontSize: 20, fontFamily: SERIF, color: p.ink }} />
          <TextWidget text={tr('Touche + pour ajouter une tâche')} style={{ fontSize: 11, fontFamily: MEDIUM, color: p.muted }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent', marginTop: 4 }}>
          {items.map((t) => (
            <Row key={t.id} task={t} p={p} />
          ))}
        </ListWidget>
      )}
    </Frame>
  );
}

/** 2×2 et étroit : compteur, pinceau d'avancement, liste courte. */
function Small({ db, p, s, look }: { db: DB; p: Pal; s: Size; look: Look }) {
  const { pending, doneToday } = pickWidgetTasks(db);
  const prog = dayProgress(db);
  const items = [...pending.slice(0, 10), ...doneToday];
  const barW = s.width - 24;
  return (
    <Frame size={s} p={p} art={art(db, s, p, look)} mark={mark(look)} style={{ padding: 12, flexDirection: 'column' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://taches' }} style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text="やること" style={{ fontSize: 10, fontFamily: SERIF, color: p.check }} />
          <TextWidget text={pending.length ? tr('{n} à faire', { n: pending.length }) : tr('Tâches')} style={{ fontSize: 18, fontFamily: SERIF, color: p.ink }} />
        </FlexWidget>
        <Plus p={p} size={look === 'epure' ? 26 : 30} look={look} />
      </FlexWidget>
      <FlexWidget style={{ marginTop: look === 'epure' ? 8 : 6, marginBottom: look === 'epure' ? 4 : 2 }}>
        <Progress p={p} width={barW} frac={prog.total ? prog.done / prog.total : 0} look={look} h={7} />
      </FlexWidget>
      {items.length === 0 ? (
        <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'kairos://task/new' }} style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          {look === 'epure' ? null : <TextWidget text="空" style={{ fontSize: 20, fontFamily: SERIF, color: p.check }} />}
          <TextWidget text={tr('Table rase.')} style={{ fontSize: 15, fontFamily: SERIF, color: p.ink }} />
        </FlexWidget>
      ) : (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {items.map((t) => (
            <Row key={t.id} task={t} p={p} compact />
          ))}
        </ListWidget>
      )}
    </Frame>
  );
}

/** Une seule rangée (4×1, 2×1) : la prochaine tâche, cochable, et le compteur. */
function Strip({ db, p, s, look }: { db: DB; p: Pal; s: Size; look: Look }) {
  const { pending } = pickWidgetTasks(db);
  const next = pending[0];
  return (
    <Frame size={s} p={p} art={art(db, s, p, look)} mark={mark(look)} markSize={Math.round(s.height * 0.8)} style={{ paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
      {next ? <Check task={next} p={p} size={22} /> : null}
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: next ? `kairos://task/${next.id}` : 'kairos://taches' }} style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget text={next ? next.title : tr('Table rase.')} maxLines={1} truncate="END" style={{ fontSize: 14, fontFamily: next ? MEDIUM : SERIF, color: p.ink }} />
        <TextWidget
          text={pending.length > 1 ? 'やること · ' + trn(pending.length - 1, '+ {n} autre', '+ {n} autres') : 'やること'}
          style={{ fontSize: 10, fontFamily: SERIF, color: p.check }}
        />
      </FlexWidget>
      <FlexWidget style={{ width: 8 }} />
      <Plus p={p} size={look === 'epure' ? 26 : 30} look={look} />
    </Frame>
  );
}

export function TasksWidget({ db, size, look = 'komorebi' }: { db: DB; size?: Size; look?: Look }) {
  const s = sizeOr(size, { width: 320, height: 250 });
  const layout = layoutOf(s);
  const C = layout === 'bande' ? Strip : layout === 'petit' ? Small : Body;
  return { light: <C db={db} p={LIGHT} s={s} look={look} />, dark: <C db={db} p={DARK} s={s} look={look} /> };
}
