import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, LayoutChangeEvent, View } from 'react-native';
import ReanimatedSwipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { Easing, interpolate, SharedValue, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useStore } from '../data/store';
import { Task, TaskRepeat } from '../data/types';
import { relativeLabel, todayKey } from '../lib/date';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { Card, Check, success, tap, Txt } from './ui';

function Meta({ icon, text, color }: { icon: React.ComponentProps<typeof Feather>['name']; text?: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 180 }}>
      <Feather name={icon} size={11} color={color} />
      {text ? (
        <Txt v="small" color={color} numberOfLines={1} style={{ fontSize: 12 }}>
          {text}
        </Txt>
      ) : null}
    </View>
  );
}

/** Petite feuille (pour l'animation de fin de tâche). */
function Leaf({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 20 C4 10 10 4 20 4 C20 14 14 20 4 20 Z" fill={color} />
      <Path d="M4 20 L14 10" stroke="#00000033" strokeWidth={1.2} />
    </Svg>
  );
}

function SwipeAction({ side, progress, label, icon, bg, fg }: { side: 'left' | 'right'; progress: SharedValue<number>; label: string; icon: React.ComponentProps<typeof Feather>['name']; bg: string; fg: string }) {
  const style = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 0.6, 1], [0, 0.8, 1]), transform: [{ scale: interpolate(progress.value, [0, 1], [0.8, 1]) }] }));
  return (
    <View style={{ width: 110, marginBottom: 8, borderRadius: 18, backgroundColor: bg, justifyContent: 'center', alignItems: side === 'left' ? 'flex-start' : 'flex-end', paddingHorizontal: 20 }}>
      <Animated.View style={[{ alignItems: 'center', gap: 2 }, style]}>
        <Feather name={icon} size={20} color={fg} />
        <Txt v="small" color={fg} style={{ fontSize: 11 }}>
          {label}
        </Txt>
      </Animated.View>
    </View>
  );
}

/**
 * Une tâche : toucher → éditer, appui long → supprimer, balayer vers la droite → faite,
 * vers la gauche → reportée à demain. En cochant, un trait de pinceau barre le titre
 * et une feuille tombe doucement.
 */
export function TaskItem({ task, compact, swipe = true, dragging }: { task: Task; compact?: boolean; swipe?: boolean; dragging?: boolean }) {
  const t = useTheme();
  const { toggleTask, deleteTask, postponeTask, db } = useStore();
  const today = todayKey();
  const overdue = !task.done && !!task.due && task.due < today;
  const subDone = task.subtasks.filter((s) => s.done).length;
  const ev = task.eventId ? db.events.find((e) => e.id === task.eventId) : undefined;
  const swipeRef = useRef<SwipeableMethods>(null);

  const [celebrating, setCelebrating] = useState(false);
  const [titleW, setTitleW] = useState(0);
  const strike = useSharedValue(task.done ? 1 : 0);
  const leaf = useSharedValue(0);
  const shownDone = task.done || celebrating;

  const complete = () => {
    if (task.done) {
      tap();
      strike.value = withTiming(0, { duration: 200 });
      toggleTask(task.id);
      return;
    }
    success();
    setCelebrating(true);
    strike.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    leaf.value = 0;
    leaf.value = withDelay(120, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }));
    // on laisse l'animation se jouer avant que la tâche quitte la liste
    setTimeout(() => {
      toggleTask(task.id);
      setCelebrating(false);
    }, 650);
  };

  const strikeStyle = useAnimatedStyle(() => ({ width: titleW * strike.value }));
  const leafStyle = useAnimatedStyle(() => ({
    opacity: interpolate(leaf.value, [0, 0.1, 0.8, 1], [0, 1, 0.8, 0]),
    transform: [
      { translateY: leaf.value * 46 },
      { translateX: Math.sin(leaf.value * 6) * 10 },
      { rotate: `${leaf.value * 220}deg` },
    ],
  }));

  const body = (
    <Card
      style={{ marginBottom: 8 }}
      bg={shownDone ? t.bg : t.card}
      onPress={dragging ? undefined : () => router.push(`/task/${task.id}`)}
      onLongPress={
        dragging
          ? undefined
          : () =>
              Alert.alert(tr('Supprimer la tâche ?'), task.title, [
                { text: tr('Annuler'), style: 'cancel' },
                { text: tr('Supprimer'), style: 'destructive', onPress: () => deleteTask(task.id) },
              ])
      }
      contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: compact ? 12 : 14, paddingHorizontal: 14 }}
    >
      <View>
        <Check done={shownDone} onPress={complete} />
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 4, top: 2 }, leafStyle]}>
          <Leaf color={t.accent} />
        </Animated.View>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View>
          <Txt v="body" numberOfLines={2} color={shownDone ? t.muted : t.ink} onLayout={(e: LayoutChangeEvent) => setTitleW(e.nativeEvent.layout.width)} style={{ alignSelf: 'flex-start' }}>
            {task.title}
          </Txt>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -2, top: 10, height: 2.5, borderRadius: 2, backgroundColor: t.accent, opacity: 0.85, transform: [{ rotate: '-1.2deg' }] }, strikeStyle]} />
        </View>
        {task.due || task.subtasks.length || ev || !compact || task.repeat || task.tags?.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            {task.due ? <Meta icon={task.remind && task.time ? 'bell' : 'clock'} text={`${relativeLabel(task.due)}${task.time ? ' · ' + task.time : ''}`} color={overdue ? t.kaki : t.muted} /> : null}
            {task.subtasks.length ? <Meta icon="list" text={`${subDone}/${task.subtasks.length}`} color={t.muted} /> : null}
            {ev ? <Meta icon="link-2" text={ev.title} color={t.muted} /> : null}
            {task.repeat ? <Meta icon="repeat" text={repeatShort(task.repeat)} color={t.muted} /> : null}
            {!compact ? <Meta icon="hash" text={task.list} color={t.muted} /> : null}
            {task.tags?.length ? <Meta icon="tag" text={task.tags.slice(0, 3).join(' · ') + (task.tags.length > 3 ? ` +${task.tags.length - 3}` : '')} color={t.muted} /> : null}
          </View>
        ) : null}
      </View>
      {dragging ? <Feather name="menu" size={18} color={t.muted} /> : null}
      {!dragging && task.priority > 0 && !task.done ? (
        <View style={{ flexDirection: 'row', gap: 3 }} accessibilityLabel={task.priority === 2 ? tr('Urgente') : tr('Priorité haute')}>
          {Array.from({ length: task.priority }, (_, i) => (
            <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: task.priority === 2 ? t.kaki : t.accent }} />
          ))}
        </View>
      ) : null}
    </Card>
  );

  if (!swipe || dragging) return body;
  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={1.6}
      leftThreshold={70}
      rightThreshold={70}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={(progress) => <SwipeAction side="left" progress={progress} label={task.done ? tr('Rouvrir') : tr('Fait')} icon={task.done ? 'rotate-ccw' : 'check'} bg={t.accent} fg={t.onAccent} />}
      renderRightActions={(progress) => <SwipeAction side="right" progress={progress} label={tr('Demain')} icon="corner-up-right" bg={t.accentSoft} fg={t.ink} />}
      onSwipeableOpen={(dir) => {
        swipeRef.current?.close();
        if (dir === SwipeDirection.RIGHT) complete();
        else {
          tap();
          postponeTask(task.id, 1);
        }
      }}
      containerStyle={{ overflow: 'visible' }}
    >
      {body}
    </ReanimatedSwipeable>
  );
}


/** « 3 j », « 2 sem. », « mois »… pour la ligne de la tâche. */
function repeatShort(r: TaskRepeat): string {
  const short = { day: '{n} j', week: '{n} sem.', month: '{n} mois', year: '{n} an' }[r.unit];
  const one = { day: 'chaque jour', week: 'chaque sem.', month: 'chaque mois', year: 'chaque année' }[r.unit];
  return r.every <= 1 ? tr(one) : tr(short, { n: r.every });
}
