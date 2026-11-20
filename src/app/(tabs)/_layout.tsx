import Feather from '@expo/vector-icons/Feather';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconName, tap, Txt } from '../../components/ui';
import { tr } from '../../i18n';
import { useTheme } from '../../theme';

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'sun', label: 'Jour' },
  agenda: { icon: 'calendar', label: 'Agenda' },
  taches: { icon: 'check-square', label: 'Tâches' },
  notes: { icon: 'feather', label: 'Notes' },
  plus: { icon: 'compass', label: 'Plus' },
};

// Barre d'onglets plate, posée sur le papier : un filet fin au-dessus,
// l'onglet actif passe à l'encre avec un point sauge dessous.
function MatchaTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.bg,
        borderTopWidth: StyleSheet.hairlineWidth * 2,
        borderColor: t.line,
        paddingTop: 10,
        paddingBottom: insets.bottom + 10,
      }}
    >
      {state.routes.map((route, i) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === i;
        const fg = focused ? t.ink : t.muted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tr(meta.label)}
            onPress={() => {
              tap();
              const ev = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !ev.defaultPrevented) navigateToTab(route.key);
            }}
            style={{ flex: 1, alignItems: 'center', gap: 4 }}
          >
            <Feather name={meta.icon} size={20} color={fg} />
            <Txt v="small" color={fg} style={{ fontSize: 10.5, fontFamily: focused ? t.font.medium : t.font.regular }}>
              {tr(meta.label)}
            </Txt>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: focused ? t.accent : 'transparent' }} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs tabBar={(props) => <MatchaTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg }, animation: 'fade' }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="agenda" />
      <Tabs.Screen name="taches" />
      <Tabs.Screen name="notes" />
      <Tabs.Screen name="plus" />
    </Tabs>
  );
}
