import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { close } from '../components/editor';
import { Enso } from '../components/Enso';
import { Komorebi } from '../components/Komorebi';
import { Chip, Grain, IconBtn, success, thud, Txt } from '../components/ui';
import { Ambient, playAmbient, ringBell, stopAmbient } from '../lib/sounds';
import { useStore } from '../data/store';
import { todayKey } from '../lib/date';
import { cancelNotification, scheduleFocusEnd } from '../lib/notifications';
import { tr, trn } from '../i18n';
import { useTheme } from '../theme';

type Phase = 'focus' | 'pause';
interface Run {
  phase: Phase;
  endAt: number | null; // en cours
  remaining: number; // secondes restantes (si en pause)
  total: number;
  notifId: string | null;
}

const KEY = 'kairos:focus-run';
const DURATIONS = [15, 25, 45, 60];

export default function Focus() {
  useKeepAwake();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { db, updateSettings, addFocus } = useStore();
  const focusMin = db.settings.focusMinutes;
  const breakMin = db.settings.breakMinutes;

  const [run, setRun] = useState<Run>({ phase: 'focus', endAt: null, remaining: focusMin * 60, total: focusMin * 60, notifId: null });
  const [now, setNow] = useState(() => Date.now());
  const restored = useRef(false);
  const bellRef = useRef(db.settings.focusBell);
  useEffect(() => {
    bellRef.current = db.settings.focusBell;
  }, [db.settings.focusBell]);
  const runRef = useRef(run);

  const update = (next: Run) => {
    runRef.current = next;
    setRun(next);
  };

  // Reprend une session en cours (si on a quitté l'écran)
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((s) => {
      if (s) {
        try {
          const saved = JSON.parse(s) as Run;
          runRef.current = saved;
          setRun(saved);
        } catch {}
      }
      restored.current = true;
    });
  }, []);
  useEffect(() => {
    if (restored.current) AsyncStorage.setItem(KEY, JSON.stringify(run)).catch(() => {});
  }, [run]);

  // Horloge + détection de fin de phase (dans le callback, pas pendant le rendu)
  useEffect(() => {
    const tick = () => {
      const n = Date.now();
      setNow(n);
      const r = runRef.current;
      if (r.endAt === null || n < r.endAt) return;
      if (bellRef.current) ringBell();
      if (r.phase === 'focus') {
        addFocus({ date: todayKey(), minutes: Math.round(r.total / 60) });
        success();
        update({ ...r, phase: 'pause', endAt: null, remaining: breakMin * 60, total: breakMin * 60, notifId: null });
      } else {
        thud();
        update({ ...r, phase: 'focus', endAt: null, remaining: focusMin * 60, total: focusMin * 60, notifId: null });
      }
    };
    tick();
    const i = setInterval(tick, 250);
    const sub = AppState.addEventListener('change', tick);
    return () => {
      clearInterval(i);
      sub.remove();
    };
  }, [addFocus, breakMin, focusMin]);

  const left = run.endAt ? Math.max(0, Math.round((run.endAt - now) / 1000)) : run.remaining;
  const running = run.endAt !== null;

  // ambiance sonore : seulement pendant la concentration, coupée en pause et en quittant l'écran
  const sound = db.settings.focusSound;
  useEffect(() => {
    playAmbient(running && run.phase === 'focus' ? sound : 'aucun');
  }, [running, run.phase, sound]);
  useEffect(() => () => stopAmbient(), []);

  const start = async () => {
    thud();
    const notifId = await scheduleFocusEnd(left, run.phase);
    update({ ...runRef.current, endAt: Date.now() + left * 1000, notifId });
  };
  const pause = async () => {
    thud();
    await cancelNotification(run.notifId);
    update({ ...runRef.current, endAt: null, remaining: left, notifId: null });
  };
  const reset = async (phase: Phase = run.phase, minutes?: number) => {
    await cancelNotification(run.notifId);
    const m = minutes ?? (phase === 'focus' ? focusMin : breakMin);
    update({ ...runRef.current, phase, endAt: null, remaining: m * 60, total: m * 60, notifId: null });
  };

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const progress = 1 - left / Math.max(1, run.total);
  const todayMin = db.focus.filter((f) => f.date === todayKey()).reduce((a, f) => a + f.minutes, 0);
  const sessions = db.focus.filter((f) => f.date === todayKey()).length;
  const ensoSize = Math.min(width - 60, 300);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Komorebi height={height} />
      <Grain />
      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconBtn icon="chevron-down" label={tr('Fermer')} onPress={close} size={40} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Txt v="jp" color={t.accent} style={{ fontSize: 15 }}>
              {run.phase === 'focus' ? '集中' : '静'}
            </Txt>
            <Txt v="kicker" color={t.muted}>
              {run.phase === 'focus' ? tr('Concentration') : tr('Respiration')}
            </Txt>
          </View>
          <IconBtn icon="rotate-ccw" label={tr('Réinitialiser')} onPress={() => reset()} size={40} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Enso size={ensoSize} progress={progress} stroke={9} color={run.phase === 'focus' ? t.accent : t.swatch('ciel')}>
            <Txt
              style={{ fontFamily: t.font.mincho, fontSize: 72, lineHeight: 84, fontVariant: ['tabular-nums'] }}
              accessibilityLabel={tr('{m} minutes {s} secondes restantes', { m: mm, s: ss })}
            >
              {mm}:{ss}
            </Txt>
            <Txt v="body" color={t.inkSoft} style={{ fontFamily: t.font.mincho, marginTop: 2 }}>
              {run.phase === 'focus' ? (running ? tr('Une chose à la fois.') : tr('Prêt ?')) : tr('Lâche l’écran, respire.')}
            </Txt>
          </Enso>

          {!running && run.phase === 'focus' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 30 }}>
              {DURATIONS.map((d) => (
                <Chip
                  key={d}
                  label={`${d} min`}
                  active={run.total === d * 60}
                  onPress={() => {
                    updateSettings({ focusMinutes: d });
                    reset('focus', d);
                  }}
                />
              ))}
            </View>
          ) : null}
          {run.phase === 'focus' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {SOUNDS.map((x) => (
                <Chip key={x.id} label={tr(x.label)} icon={x.icon} active={sound === x.id} onPress={() => updateSettings({ focusSound: x.id })} />
              ))}
              <Chip label={tr('Cloche')} icon="bell" active={db.settings.focusBell} onPress={() => updateSettings({ focusBell: !db.settings.focusBell })} />
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <IconBtn
            icon={run.phase === 'focus' ? 'coffee' : 'target'}
            label={run.phase === 'focus' ? tr('Passer à la pause') : tr('Passer au focus')}
            onPress={() => reset(run.phase === 'focus' ? 'pause' : 'focus')}
            size={52}
          />
          <Pressable
            onPress={running ? pause : start}
            accessibilityRole="button"
            accessibilityLabel={running ? tr('Pause') : tr('Démarrer')}
            style={({ pressed }) => ({
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: t.accent,
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <Feather name={running ? 'pause' : 'play'} size={32} color={t.onAccent} style={{ marginLeft: running ? 0 : 4 }} />
          </Pressable>
          <View style={{ width: 52, alignItems: 'center' }} accessibilityLabel={trn(sessions, "{n} session aujourd'hui", "{n} sessions aujourd'hui")}>
            <Txt v="num" style={{ fontSize: 22 }}>
              {sessions}
            </Txt>
            <Txt v="small" color={t.muted} style={{ fontSize: 10 }}>
              {tr('sessions')}
            </Txt>
          </View>
        </View>

        <Txt v="small" color={t.muted} style={{ textAlign: 'center', marginTop: 18 }}>
          {tr('{n} min de concentration aujourd’hui · notification à la fin, même écran éteint', { n: todayMin })}
        </Txt>
      </View>
    </View>
  );
}

const SOUNDS: { id: Ambient; label: string; icon: 'volume-x' | 'cloud-rain' | 'droplet' }[] = [
  { id: 'aucun', label: 'Silence', icon: 'volume-x' },
  { id: 'pluie', label: 'Pluie', icon: 'cloud-rain' },
  { id: 'ruisseau', label: 'Ruisseau', icon: 'droplet' },
];
