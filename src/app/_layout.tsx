import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { UndoToast } from '../components/UndoToast';
import { StoreProvider, useStore } from '../data/store';
import { ACTION_DONE, ACTION_SNOOZE, initNotifications, notificationKind, snoozeNotification } from '../lib/notifications';
import { resolveLang, setLang } from '../i18n';
import { ThemeProvider, useTheme } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function openFromNotification(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const kind = notificationKind(data);
  if ((kind === 'event' || kind === 'leave' || kind === 'rain') && data.id) router.push(data.date ? { pathname: '/event/[id]', params: { id: String(data.id), date: String(data.date) } } : `/event/${data.id}`);
  else if (kind === 'task' && data.id) router.push(`/task/${data.id}`);
  else if (kind === 'note' && data.id) router.push(`/note/${data.id}`);
  else if (kind === 'focus') router.push('/focus');
  else if (kind === 'brief') router.navigate('/');
  else if (kind === 'rain') router.push('/meteo');
}

// Réponses déjà traitées (getLastNotificationResponse renvoie la dernière à chaque montage)
const handled = new Set<string>();

function Shell() {
  const t = useTheme();
  const { ready, db, toggleTask } = useStore();
  const pending = useRef<Notifications.NotificationResponse[]>([]);
  const dbRef = useRef(db);
  const toggleRef = useRef(toggleTask);
  useEffect(() => {
    dbRef.current = db;
    toggleRef.current = toggleTask;
  }, [db, toggleTask]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Tap sur la notification ou sur un de ses boutons (« Fait », « Dans 10 min »)
  const handle = useCallback(
    async (r: Notifications.NotificationResponse) => {
      const key = `${r.notification.request.identifier}:${r.actionIdentifier}`;
      if (handled.has(key)) return;
      handled.add(key);
      const req = r.notification.request;
      const data = req.content.data as Record<string, unknown> | undefined;
      if (r.actionIdentifier === ACTION_DONE) {
        const task = dbRef.current.tasks.find((x) => x.id === data?.id);
        if (task && !task.done) toggleRef.current(task.id);
        await Notifications.dismissNotificationAsync(req.identifier).catch(() => {});
      } else if (r.actionIdentifier === ACTION_SNOOZE) {
        await snoozeNotification(req.content).catch(() => {});
        await Notifications.dismissNotificationAsync(req.identifier).catch(() => {});
      } else {
        openFromNotification(data);
      }
    },
    [],
  );

  // On attend que les données soient chargées (démarrage à froid) avant d'agir
  const readyRef = useRef(ready);
  const flush = useCallback(() => {
    if (!readyRef.current) return;
    const list = pending.current.splice(0);
    list.forEach((r, i) => setTimeout(() => handle(r), 300 + i * 50));
  }, [handle]);

  useEffect(() => {
    readyRef.current = ready;
    if (ready) flush();
  }, [ready, flush]);

  useEffect(() => {
    initNotifications().catch(() => {});
    // notification touchée alors que l'app était fermée
    const last = Notifications.getLastNotificationResponse();
    if (last) pending.current.push(last);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      pending.current.push(r);
      flush();
    });
    flush();
    return () => sub.remove();
  }, [flush]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
          animation: 'fade_from_bottom',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="focus" options={{ animation: 'fade_from_bottom' }} />
      </Stack>
      <UndoToast />
    </>
  );
}

function Themed() {
  const { db } = useStore();
  // langue : fixée avant de dessiner les écrans ; tout l'arbre est remonté quand elle change
  const lang = resolveLang(db.settings.language);
  setLang(lang);
  return (
    <ThemeProvider mode={db.settings.theme} seasonal={db.settings.seasonal} hemisphere={db.settings.hemisphere}>
      <Shell key={lang} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Polices allégées (voir scripts/subset-fonts.sh) : latin + kana + quelques kanji
  const [fontsLoaded] = useFonts({
    'Mincho-Medium': require('../../assets/fonts/Mincho-Medium.ttf'),
    'Mincho-Bold': require('../../assets/fonts/Mincho-Bold.ttf'),
    'Gothic-Regular': require('../../assets/fonts/Gothic-Regular.ttf'),
    'Gothic-Medium': require('../../assets/fonts/Gothic-Medium.ttf'),
    'Gothic-Bold': require('../../assets/fonts/Gothic-Bold.ttf'),
  });
  if (!fontsLoaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StoreProvider>
          <Themed />
        </StoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
