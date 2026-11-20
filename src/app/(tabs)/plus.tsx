import Feather from '@expo/vector-icons/Feather';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { DeviceCalendarSettings } from '../../components/DeviceCalendarSettings';
import { HolidaySettings } from '../../components/HolidaySettings';
import { Card, Chip, Divider, Header, IconName, Row, Screen, Section, success, Toggle, Txt } from '../../components/ui';
import { useStore } from '../../data/store';
import { EMPTY_DB, ThemeMode, WidgetStyle } from '../../data/types';
import { countPhotos, exportBackup, pickBackup } from '../../lib/backup';
import { deletePhotos } from '../../lib/photos';
import { currentMicroSeason } from '../../lib/seasons';
import { ageLabel, clearWeather, refreshWeather, useWeather } from '../../lib/weather';
import { addDays, DAYS_SHORT, fromKey, todayKey, weekKeys } from '../../lib/date';
import { CHANNEL_REMINDERS, initNotifications } from '../../lib/notifications';
import { pickTime } from '../../lib/pickers';
import { streak } from '../../lib/stats';
import { locale, tr, trn } from '../../i18n';
import { seasonNow, useTheme } from '../../theme';
import { widgetAvailable } from '../../widget/bridge';
import { appVersion, checkApk, fetchOta, otaDate, REPO, restartWithUpdate } from '../../lib/appUpdate';

export default function Plus() {
  const t = useTheme();
  const { db, updateSettings, replaceAll } = useStore();
  const s = db.settings;
  const [newList, setNewList] = useState('');
  const today = todayKey();
  const weather = useWeather(s.weather);
  const kou = currentMicroSeason(new Date(), s.hemisphere);
  const photos = countPhotos(db);
  const photosNote = photos ? ` ${trn(photos, 'La photo des notes n’est pas incluse dans l’export.', 'Les {n} photos des notes ne sont pas incluses dans l’export.')}` : '';

  const toggleWeather = async (on: boolean) => {
    updateSettings({ weather: on });
    if (on) {
      const w = await refreshWeather(true);
      if (!w) Alert.alert(tr('Météo indisponible'), tr('Vérifie l’accès à la localisation et la connexion, puis réessaie depuis l’écran Météo.'));
    } else await clearWeather();
  };

  // ── Bilan de la semaine ──
  const week = weekKeys(today);
  const stats = (() => {
    const perDay = week.map((k) => {
      const start = fromKey(k).getTime();
      const end = fromKey(addDays(k, 1)).getTime();
      return db.tasks.filter((x) => x.done && (x.doneAt ?? 0) >= start && (x.doneAt ?? 0) < end).length;
    });
    const focus = db.focus.filter((f) => f.date >= week[0] && f.date <= week[6]).reduce((a, f) => a + f.minutes, 0);
    const habitSlots = db.habits.length * (week.indexOf(today) + 1);
    const habitDone = db.habits.reduce((a, h) => a + h.log.filter((d) => d >= week[0] && d <= today).length, 0);
    const best = db.habits.reduce((a, h) => Math.max(a, streak(h)), 0);
    return { perDay, focus, habitPct: habitSlots ? Math.round((habitDone / habitSlots) * 100) : 0, best };
  })();
  const maxBar = Math.max(1, ...stats.perDay);

  const addList = () => {
    const name = newList.trim();
    if (!name || s.lists.includes(name)) return;
    updateSettings({ lists: [...s.lists, name] });
    setNewList('');
  };

  const removeList = (name: string) => {
    if (s.lists.length <= 1) return Alert.alert(tr('Il faut garder au moins une liste.'));
    const used = db.tasks.filter((x) => x.list === name).length;
    const fallback = s.lists.find((l) => l !== name)!;
    Alert.alert(tr('Supprimer « {name} » ?', { name }), used ? trn(used, '{n} tâche sera déplacée dans « {list} ».', '{n} tâches seront déplacées dans « {list} ».', { list: fallback }) : undefined, [
      { text: tr('Annuler'), style: 'cancel' },
      {
        text: tr('Supprimer'),
        style: 'destructive',
        onPress: () =>
          replaceAll({
            ...db,
            tasks: db.tasks.map((x) => (x.list === name ? { ...x, list: fallback } : x)),
            settings: { ...s, lists: s.lists.filter((l) => l !== name) },
          }),
      },
    ]);
  };

  const testNotif = async () => {
    const ok = await initNotifications();
    if (!ok) {
      Alert.alert(tr('Notifications bloquées'), tr('Autorise les notifications de Kairos dans les réglages Android.'), [
        { text: tr('Plus tard'), style: 'cancel' },
        { text: tr('Ouvrir les réglages'), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: tr('Kairos est à l’heure'), body: tr('Les rappels fonctionnent. Celle-ci arrive 3 secondes après le test.') },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CHANNEL_REMINDERS },
    });
    success();
  };

  const doExport = async () => {
    try {
      await exportBackup(db);
    } catch (e) {
      Alert.alert(tr('Export impossible'), String((e as Error).message ?? e));
    }
  };

  const doImport = async () => {
    try {
      const res = await pickBackup();
      if (!res) return;
      Alert.alert(tr('Restaurer cette sauvegarde ?'), tr('{counts}.\n\nTes données actuelles seront remplacées.', { counts: res.counts }), [
        { text: tr('Annuler'), style: 'cancel' },
        {
          text: tr('Restaurer'),
          style: 'destructive',
          onPress: () => {
            replaceAll(res.data);
            success();
          },
        },
      ]);
    } catch (e) {
      Alert.alert(tr('Import impossible'), String((e as Error).message ?? e));
    }
  };

  const wipe = () =>
    Alert.alert(tr('Tout effacer ?'), tr('Événements, tâches, notes, rituels : tout disparaît. Pense à exporter avant.'), [
      { text: tr('Annuler'), style: 'cancel' },
      {
        text: tr('Tout effacer'),
        style: 'destructive',
        onPress: () => {
          deletePhotos([...db.notes.flatMap((n) => n.photos ?? []), ...db.trash.flatMap((x) => (x.kind === 'note' ? x.item.photos ?? [] : []))]);
          replaceAll({ ...EMPTY_DB, settings: s });
        },
      },
    ]);

  return (
    <Screen komorebi komorebiHeight={240}>
      <Header kicker={tr('Outils et réglages')} title={tr('Plus')} jp="道具" />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Tile icon="target" title="Focus" jp="集中" sub={`${s.focusMinutes} min`} bg={t.accentSoft} onPress={() => router.push('/focus')} />
        <Tile icon="repeat" title={tr('Rituels')} jp="習慣" sub={trn(db.habits.length, '{n} actif', '{n} actifs')} onPress={() => router.push('/habits')} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <Tile icon="book-open" title="Journal" jp="日記" sub={trn(db.journal.length, '{n} jour écrit', '{n} jours écrits')} onPress={() => router.push('/journal')} />
        <Tile icon="feather" title={tr('Bonsaï')} jp="盆栽" sub={tr('Ton année qui pousse')} onPress={() => router.push('/jardin')} />
      </View>

      {/* ── Bilan ── */}
      <Section jp="記録" title={tr('Ta semaine')}>
        <Card radius={22} contentStyle={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 92, gap: 10 }}>
            {stats.perDay.map((n, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                <Txt v="num" style={{ fontSize: 11, marginBottom: 4 }} color={n ? t.ink : t.muted}>
                  {n}
                </Txt>
                <View style={{ width: '70%', height: Math.max(3, (n / maxBar) * 64), borderRadius: 6, backgroundColor: week[i] === today ? t.accent : t.accentSoft }} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            {week.map((k) => (
              <Txt key={k} v="small" color={k === today ? t.accent : t.muted} style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
                {DAYS_SHORT[fromKey(k).getDay()]}
              </Txt>
            ))}
          </View>
          <Txt v="small" color={t.muted} style={{ marginTop: 4, textAlign: 'center' }}>
            {tr('Tâches terminées par jour')}
          </Txt>
          <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: t.line, marginVertical: 16 }} />
          <View style={{ flexDirection: 'row' }}>
            <Mini n={`${stats.focus}`} label={tr('min de focus')} />
            <Mini n={`${stats.habitPct}%`} label={tr('rituels tenus')} />
            <Mini n={`${stats.best}`} label={tr('meilleure série')} />
          </View>
        </Card>
      </Section>

      {/* ── Toi & apparence ── */}
      <Section jp="設定" title={tr('Apparence')}>
        <Card radius={20}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 6 }}>
            <Feather name="user" size={17} color={t.accent} />
            <TextInput
              value={s.name}
              onChangeText={(name) => updateSettings({ name })}
              placeholder={tr('Ton prénom (pour le bonjour)')}
              placeholderTextColor={t.muted}
              selectionColor={t.selection}
              cursorColor={t.accent}
              selectionHandleColor={t.accent}
              style={{ flex: 1, fontFamily: t.font.regular, fontSize: 15, color: t.ink, paddingVertical: 10 }}
            />
          </View>
          <Divider />
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Feather name={t.dark ? 'moon' : 'sun'} size={17} color={t.accent} />
              <Txt v="body">{tr('Thème')}</Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, paddingLeft: 31 }}>
              {(['auto', 'jour', 'nuit'] as ThemeMode[]).map((m) => (
                <Chip key={m} label={m === 'auto' ? tr('Auto') : m === 'jour' ? tr('Jour') : tr('Nuit')} active={s.theme === m} onPress={() => updateSettings({ theme: m })} />
              ))}
            </View>
          </View>
          <Divider />
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Feather name="globe" size={17} color={t.accent} />
              <Txt v="body">{tr('Langue')}</Txt>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, paddingLeft: 31 }}>
              {(['auto', 'fr', 'en'] as const).map((l) => (
                <Chip key={l} label={l === 'auto' ? tr('Auto') : l === 'fr' ? 'Français' : 'English'} active={(s.language ?? 'auto') === l} onPress={() => updateSettings({ language: l })} />
              ))}
            </View>
          </View>
          <Divider />
          <Row icon="wind" label={tr('Lumière komorebi animée')} right={<Toggle value={s.ambiance} onChange={(ambiance) => updateSettings({ ambiance })} />} />
          <Divider />
          <Row
            icon="droplet"
            label={`${tr('Couleur de la saison')}${s.seasonal ? ` · ${tr(SEASON_NAMES[seasonNow(s.hemisphere)])}` : ''}`}
            right={<Toggle value={s.seasonal} onChange={(seasonal) => updateSettings({ seasonal })} />}
          />
        </Card>
        <Txt v="small" color={t.muted} style={{ marginTop: 8 }}>
          {tr('Les ombres de feuillage bougent et suivent l’inclinaison du téléphone. Désactive pour économiser la batterie.')}
        </Txt>
      </Section>

      {/* ── Météo ── */}
      <Section jp="天気" title={tr('Météo')}>
        <Card radius={20}>
          <Row icon="cloud" label={tr('Afficher la météo')} right={<Toggle value={s.weather} onChange={toggleWeather} />} />
          {s.weather ? (
            <>
              <Divider />
              <Row
                icon="map-pin"
                label={weather.data?.place ?? tr('Position')}
                value={weather.loading ? tr('mise à jour…') : weather.data ? ageLabel(weather.data.fetchedAt) : weather.error ? tr('erreur') : '—'}
                onPress={() => router.push('/meteo')}
              />
              <Divider />
              <Row icon="cloud-rain" label={tr('Alerte pluie')} right={<Toggle value={s.rainAlerts} onChange={(rainAlerts) => updateSettings({ rainAlerts })} />} />
            </>
          ) : null}
        </Card>
        <Txt v="small" color={t.muted} style={{ marginTop: 8 }}>
          {tr('Prévisions Open-Meteo, gratuites et sans compte. Seule ta position, arrondie à environ 1 km, leur est envoyée. Hors-ligne, la dernière météo reste affichée. L’alerte pluie prévient avant une averse et une heure avant un rendez-vous sous la pluie.')}
        </Txt>
      </Section>

      {/* ── Saisons ── */}
      <Section jp="七十二候" title={tr('Micro-saisons')}>
        <Card radius={20} contentStyle={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Txt v="jp" color={t.accent} style={{ fontSize: 18 }}>
              {kou.season.jp}
            </Txt>
            <Txt v="small" color={t.muted}>
              {kou.season.sekki} · {kou.kindLabel}
            </Txt>
          </View>
          <Txt v="body">{tr(kou.season.fr)}</Txt>
          <Txt v="small" color={t.muted}>
            {tr('L’année japonaise compte 72 saisons de cinq jours. Elles teintent la lumière et les particules de l’app.')}
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Txt v="small" color={t.inkSoft}>
              {tr('Hémisphère')}
            </Txt>
            <Chip label={tr('Nord')} active={s.hemisphere === 'nord'} onPress={() => updateSettings({ hemisphere: 'nord' })} />
            <Chip label={tr('Sud')} active={s.hemisphere === 'sud'} onPress={() => updateSettings({ hemisphere: 'sud' })} />
          </View>
          {s.weather ? (
            <Txt v="small" color={t.muted} style={{ fontSize: 11.5 }}>
              {tr('Réglé automatiquement d’après la position météo.')}
            </Txt>
          ) : null}
        </Card>
      </Section>

      {/* ── Jours fériés et vacances ── */}
      <Section jp="休日" title={tr('Jours fériés et vacances')}>
        <HolidaySettings />
      </Section>

      {/* ── Trajets ── */}
      <Section jp="道" title={tr('Trajets')}>
        <Card radius={20}>
          <Row icon="navigation" label={tr('Rappels « pars maintenant »')} right={<Toggle value={s.leaveAlerts} onChange={(leaveAlerts) => updateSettings({ leaveAlerts })} />} />
          <Divider />
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
            <Txt v="body">{tr('Je me déplace…')}</Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label={tr('En voiture')} icon="truck" active={s.travelMode === 'car'} onPress={() => updateSettings({ travelMode: 'car' })} />
              <Chip label={tr('À vélo')} icon="wind" active={s.travelMode === 'bike'} onPress={() => updateSettings({ travelMode: 'bike' })} />
              <Chip label={tr('À pied')} icon="user" active={s.travelMode === 'foot'} onPress={() => updateSettings({ travelMode: 'foot' })} />
            </View>
          </View>
        </Card>
        <Txt v="small" color={t.muted} style={{ marginTop: 8 }}>
          {tr('Choisis un lieu dans les suggestions d’un événement, puis active « Me prévenir quand partir ». Le trajet est calculé par les services OpenStreetMap depuis ta position (arrondie à ~100 m), sans tenir compte du trafic.')}
        </Txt>
      </Section>

      {/* ── Calendriers du téléphone ── */}
      <Section jp="暦" title={tr('Calendriers')}>
        <DeviceCalendarSettings />
      </Section>

      {/* ── Rappels ── */}
      <Section title={tr('Rappels')}>
        <Card radius={20}>
          <Row icon="sunrise" label={tr('Brief du matin')} right={<Toggle value={s.briefEnabled} onChange={(v) => updateSettings({ briefEnabled: v })} />} />
          {s.briefEnabled ? (
            <>
              <Divider />
              <Row
                icon="clock"
                label={tr('Heure du brief')}
                value={s.briefTime}
                onPress={async () => {
                  const v = await pickTime(s.briefTime);
                  if (v) updateSettings({ briefTime: v });
                }}
              />
            </>
          ) : null}
          <Divider />
          <Row icon="bell" label={tr('Tester une notification')} onPress={testNotif} />
        </Card>
        <Txt v="small" color={t.muted} style={{ marginTop: 8 }}>
          {tr('Tous les rappels sont programmés sur le téléphone : aucun serveur, aucune connexion requise.')}
        </Txt>
      </Section>

      {/* ── Listes ── */}
      <Section title={tr('Listes de tâches')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {s.lists.map((l) => (
            <Pressable
              key={l}
              onLongPress={() => removeList(l)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: t.bgAlt }}
            >
              <Txt v="small"># {l}</Txt>
              <Feather name="x" size={13} color={t.muted} onPress={() => removeList(l)} />
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, borderRadius: 999, borderStyle: 'dashed', paddingHorizontal: 16 }}>
          <Feather name="plus" size={15} color={t.muted} />
          <TextInput
            value={newList}
            onChangeText={setNewList}
            onSubmitEditing={addList}
            placeholder={tr('Nouvelle liste…')}
            placeholderTextColor={t.muted}
            selectionColor={t.selection}
            cursorColor={t.accent}
            selectionHandleColor={t.accent}
            style={{ flex: 1, fontFamily: t.font.regular, fontSize: 15, color: t.ink, paddingVertical: 10 }}
          />
        </View>
      </Section>

      {/* ── Widget ── */}
      <Section title={tr('Widget')}>
        <Card bg={widgetAvailable ? t.accentSoft : t.bgAlt} bordered={false} radius={20} contentStyle={{ padding: 16, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Feather name="layout" size={18} color={t.accent} />
            <Txt v="h2" style={{ fontSize: 16 }}>
              {widgetAvailable ? tr('Widgets disponibles') : tr('Widgets : version installée requise')}
            </Txt>
          </View>
          <Txt v="small" color={t.inkSoft}>
            {widgetAvailable
              ? tr("Appui long sur l'écran d'accueil → Widgets → Kairos : Tâches, Agenda, Météo et Notes. Appui long sur un widget pour le redimensionner, de 2×1 à 4×4 : l'affichage s'adapte.")
              : tr("Expo Go ne sait pas afficher de widgets. Installe l'APK construit avec EAS pour l'activer.")}
          </Txt>
        </Card>
        <Txt v="small" color={t.muted} style={{ marginTop: 14, marginBottom: 8 }}>
          {tr('Style des widgets')}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {WIDGET_STYLES.map((o) => (
            <WidgetStyleCard key={o.id} option={o} active={(s.widgetStyle ?? 'epure') === o.id} onPress={() => updateSettings({ widgetStyle: o.id })} />
          ))}
        </View>
      </Section>

      {/* ── Mises à jour ── */}
      <Section title={tr('Mises à jour')}>
        <UpdatesCard />
      </Section>

      {/* ── Données ── */}
      <Section title={tr('Données')}>
        <Card radius={20}>
          <Row icon="link" label={tr('Aperçu des liens dans les notes')} right={<Toggle value={s.linkPreviews} onChange={(linkPreviews) => updateSettings({ linkPreviews })} />} />
          <Divider />
          <Row icon="upload" label={tr('Exporter une sauvegarde')} onPress={doExport} />
          <Divider />
          <Row icon="download" label={tr('Restaurer une sauvegarde')} onPress={doImport} />
          <Divider />
          <Row icon="archive" label={tr('Corbeille')} value={db.trash.length ? String(db.trash.length) : undefined} onPress={() => router.push('/corbeille')} />
          <Divider />
          <Row icon="trash-2" label={tr('Tout effacer')} danger onPress={wipe} />
        </Card>
        <Txt v="small" color={t.muted} style={{ marginTop: 8 }}>
          {tr('Tes notes, tâches et événements ne quittent jamais le téléphone. Seules les fonctions en ligne que tu actives (météo, jours fériés, trajets, aperçus de liens) font des requêtes, sans compte ni donnée personnelle.')}
          {photosNote}
        </Txt>
      </Section>

      <View style={{ alignItems: 'center', marginTop: 40, gap: 2 }}>
        <Txt v="jp" color={t.accent} style={{ fontSize: 22, letterSpacing: 0 }}>
          時
        </Txt>
        <Txt v="h2">Kairos</Txt>
        <Txt v="small" color={t.muted}>
          {tr('le moment opportun')} · v{appVersion()}
        </Txt>
      </View>
    </Screen>
  );
}

function Tile({ icon, title, jp, sub, bg, onPress }: { icon: IconName; title: string; jp: string; sub: string; bg?: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Card bg={bg} bordered={!bg} style={{ flex: 1 }} radius={22} onPress={onPress} contentStyle={{ padding: 16, height: 128, justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Feather name={icon} size={20} color={t.accent} />
        <Txt v="jp" color={t.accent} style={{ fontSize: 12 }}>
          {jp}
        </Txt>
      </View>
      <View>
        <Txt v="title" style={{ fontSize: 24, lineHeight: 30 }}>
          {title}
        </Txt>
        <Txt v="small" color={t.inkSoft}>
          {sub}
        </Txt>
      </View>
    </Card>
  );
}

function Mini({ n, label }: { n: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Txt style={{ fontFamily: t.font.mincho, fontSize: 24 }}>{n}</Txt>
      <Txt v="small" color={t.muted} style={{ fontSize: 11, textAlign: 'center' }}>
        {label}
      </Txt>
    </View>
  );
}

const WIDGET_STYLES: { id: WidgetStyle; name: string; tag: string; hint: string }[] = [
  { id: 'simple', name: 'Simple', tag: 'v1', hint: 'Aplat, sans décor' },
  { id: 'komorebi', name: 'Komorebi', tag: 'v2', hint: 'Feuillage, saison, kanji' },
  { id: 'epure', name: 'Épuré', tag: 'v3', hint: 'Lumière douce, l’essentiel' },
];

/** Carte de choix avec une miniature dessinée du widget dans ce style. */
function WidgetStyleCard({ option, active, onPress }: { option: (typeof WIDGET_STYLES)[number]; active: boolean; onPress: () => void }) {
  const t = useTheme();
  const id = option.id;
  const ink = t.dark ? '#E6EADB' : '#2E372D';
  const line = t.dark ? '#343C31' : '#D3D9C6';
  return (
    <Pressable
      onPress={() => {
        success();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tr('Style {name}, {hint}', { name: tr(option.name), hint: tr(option.hint) })}
      style={{ flex: 1, borderRadius: 18, padding: 8, borderWidth: active ? 1.5 : StyleSheet.hairlineWidth * 2, borderColor: active ? t.accent : t.line, backgroundColor: active ? t.accentSoft : 'transparent' }}
    >
      {/* miniature */}
      <View style={{ height: 74, borderRadius: 12, overflow: 'hidden', backgroundColor: t.bg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: line, padding: 8 }}>
        {id === 'komorebi' ? (
          <>
            <View style={{ position: 'absolute', right: -14, top: -16, width: 70, height: 70, borderRadius: 35, backgroundColor: t.accent, opacity: 0.16 }} />
            <Txt v="jp" color={t.accent} style={{ position: 'absolute', right: 2, bottom: -10, fontSize: 44, lineHeight: 52, opacity: 0.14, letterSpacing: 0 }}>
              事
            </Txt>
            {[
              [18, 50],
              [56, 16],
              [70, 46],
            ].map(([x, y], i) => (
              <View key={i} style={{ position: 'absolute', left: x, top: y, width: 5, height: 3, borderRadius: 2, backgroundColor: '#C98E9A', transform: [{ rotate: `${i * 50}deg` }] }} />
            ))}
          </>
        ) : null}
        {id === 'epure' ? <View style={{ position: 'absolute', left: -20, top: -40, width: 110, height: 80, borderRadius: 55, backgroundColor: t.dark ? '#9DB58F' : '#FFFFFF', opacity: t.dark ? 0.07 : 0.6 }} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ width: 34, height: 6, borderRadius: 3, backgroundColor: ink, opacity: 0.85 }} />
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: id === 'epure' ? 'transparent' : t.accent,
              borderWidth: id === 'epure' ? 1 : 0,
              borderColor: t.accent,
            }}
          />
        </View>
        {id === 'komorebi' ? <View style={{ height: 3, width: '60%', borderRadius: 2, backgroundColor: t.accent, marginTop: 7 }} /> : null}
        {id === 'epure' ? <View style={{ height: 1, width: '100%', backgroundColor: line, marginTop: 8 }} /> : null}
        {id === 'simple' ? <View style={{ height: 1, width: '100%', backgroundColor: line, marginTop: 7 }} /> : null}
        {[0, 1].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 }}>
            <View style={{ width: 8, height: 8, borderRadius: id === 'simple' ? 2 : 4, borderWidth: 1, borderColor: id === 'simple' ? t.muted : t.accent }} />
            <View style={{ height: 4, width: i ? '50%' : '70%', borderRadius: 2, backgroundColor: ink, opacity: 0.45 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 7 }}>
        <Txt v="bodyB" style={{ fontSize: 13.5 }}>
          {tr(option.name)}
        </Txt>
        <Txt v="small" color={t.muted} style={{ fontSize: 10 }}>
          {option.tag}
        </Txt>
      </View>
      <Txt v="small" color={t.muted} numberOfLines={2} style={{ fontSize: 10.5, lineHeight: 14 }}>
        {tr(option.hint)}
      </Txt>
    </Pressable>
  );
}

/** Version installée, vérification manuelle, et réglage de la vérification GitHub. */
function UpdatesCard() {
  const t = useTheme();
  const { db, updateSettings } = useStore();
  const [state, setState] = useState<'idle' | 'checking' | 'uptodate' | 'ota' | 'apk' | 'offline'>('idle');
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const [apkVersion, setApkVersion] = useState('');
  const ota = otaDate();

  const check = async () => {
    setState('checking');
    const [o, a] = await Promise.all([fetchOta(), checkApk(true)]);
    if (o) return setState('ota');
    if (a) {
      setApkUrl(a.url);
      setApkVersion(a.version);
      return setState('apk');
    }
    setState('uptodate');
  };

  return (
    <>
      <Card radius={20}>
        <Row icon="info" label={tr('Version installée')} value={`v${appVersion()}${ota ? ` · ${tr('code du {date}', { date: ota.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) })}` : ''}`} />
        <Divider />
        {state === 'ota' ? (
          <Row icon="refresh-cw" label={tr('Mise à jour prête : relancer')} onPress={restartWithUpdate} />
        ) : state === 'apk' && apkUrl ? (
          <Row icon="download" label={tr('Télécharger Kairos {version}', { version: apkVersion })} onPress={() => Linking.openURL(apkUrl).catch(() => {})} />
        ) : (
          <Row
            icon="refresh-cw"
            label={state === 'checking' ? tr('Vérification…') : state === 'uptodate' ? tr('À jour ✓') : tr('Vérifier maintenant')}
            onPress={state === 'checking' ? undefined : check}
          />
        )}
        <Divider />
        <Row icon="github" label={tr('Prévenir des nouveaux APK')} right={<Toggle value={db.settings.updateCheck} onChange={(updateCheck) => updateSettings({ updateCheck })} />} />
      </Card>
      <Txt v="small" color={t.muted} style={{ marginTop: 8 }}>
        {tr('Les corrections arrivent toutes seules (relance l’app pour les appliquer). Pour les nouveautés qui demandent un nouvel APK, l’app regarde la dernière version publiée sur github.com/{repo}, sans envoyer aucune donnée.', { repo: REPO })}
      </Txt>
    </>
  );
}

const SEASON_NAMES = { printemps: 'sakura', ete: 'matcha', automne: 'érable', hiver: 'neige' } as const;
