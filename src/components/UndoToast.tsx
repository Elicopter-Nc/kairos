import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../data/store';
import { onUndoOffer } from '../lib/undo';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { success, Txt } from './ui';

const DURATION = 5000;

/** Bandeau « Note supprimée · Annuler », 5 secondes après une suppression. */
export function UndoToast() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { restoreFromTrash } = useStore();
  const [msg, setMsg] = useState<{ label: string; trashId: string; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () =>
      onUndoOffer((m) => {
        if (timer.current) clearTimeout(timer.current);
        setMsg({ ...m, key: Date.now() });
        timer.current = setTimeout(() => setMsg(null), DURATION);
      }),
    [],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!msg) return null;
  return (
    <Animated.View
      key={msg.key}
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 92 }}
    >
      <View
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingLeft: 18,
          paddingRight: 6,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: t.dark ? '#E6EADB' : '#2E372D',
          elevation: 6,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Feather name="trash-2" size={15} color={t.dark ? '#2E372D' : '#E6EADB'} />
        <Txt v="body" color={t.dark ? '#2E372D' : '#E6EADB'} style={{ flex: 1, fontSize: 14.5 }}>
          {tr(msg.label)}
        </Txt>
        <Pressable
          onPress={() => {
            success();
            restoreFromTrash(msg.trashId);
            setMsg(null);
          }}
          accessibilityRole="button"
          accessibilityLabel={tr('Annuler la suppression')}
          style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: pressed ? t.accentSoft : t.accent })}
        >
          <Txt v="bodyB" color={t.onAccent} style={{ fontSize: 14 }}>
            {tr('Annuler')}
          </Txt>
        </Pressable>
      </View>
    </Animated.View>
  );
}
