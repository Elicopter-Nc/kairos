import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { ReactNode, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventsBetween } from '../data/recurrence';
import { useStore } from '../data/store';
import { addDays, formatShort, todayKey } from '../lib/date';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { Btn, Grain, IconBtn, Sheet, tap, Txt } from './ui';

export function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function EditorShell({
  kicker,
  jp,
  onSave,
  saveLabel = tr('Enregistrer'),
  closeLabel = tr('Fermer sans enregistrer'),
  children,
  extraActions,
}: {
  kicker: string;
  jp?: string;
  onSave: () => void;
  saveLabel?: string;
  closeLabel?: string;
  children: ReactNode;
  extraActions?: ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderBottomWidth: StyleSheet.hairlineWidth * 2,
          borderColor: t.line,
        }}
      >
        <IconBtn icon="x" label={closeLabel} onPress={close} size={38} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          {jp ? (
            <Txt v="jp" color={t.accent}>
              {jp}
            </Txt>
          ) : null}
          <Txt v="kicker" color={t.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
            {kicker}
          </Txt>
        </View>
        {extraActions}
        <Btn label={saveLabel} icon="check" small onPress={onSave} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      <Grain />
    </KeyboardAvoidingView>
  );
}

/** Bouton « champ » qui ouvre un sélecteur (date, heure…) */
export function PickField({
  icon,
  label,
  value,
  placeholder,
  onPress,
  onClear,
  style,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  onClear?: () => void;
  style?: object;
}) {
  const t = useTheme();
  return (
    <View style={[{ flex: 1 }, style]}>
      <Txt v="kicker" color={t.muted} style={{ marginBottom: 6 }}>
        {label}
      </Txt>
      <Pressable
        onPress={() => {
          tap();
          onPress();
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: t.line,
          borderRadius: 14,
          backgroundColor: pressed ? t.bgAlt : t.card,
          paddingHorizontal: 14,
          paddingVertical: 13,
        })}
      >
        <Feather name={icon} size={15} color={value ? t.accent : t.muted} />
        <Txt v={value ? 'num' : 'body'} color={value ? t.ink : t.muted} style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>
          {value || placeholder}
        </Txt>
        {value && onClear ? <Feather name="x" size={15} color={t.muted} onPress={onClear} hitSlop={10} /> : null}
      </Pressable>
    </View>
  );
}

export function Label({ children, jp }: { children: string; jp?: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10, marginTop: 22 }}>
      {jp ? (
        <Txt v="jp" color={t.accent} style={{ fontSize: 12 }}>
          {jp}
        </Txt>
      ) : null}
      <Txt v="kicker" color={t.muted}>
        {children}
      </Txt>
    </View>
  );
}

/** Sélecteur d'événement : pour lier une note ou une tâche à un événement du calendrier. */
export function EventPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (eventId: string, date: string) => void }) {
  const t = useTheme();
  const { db } = useStore();
  const [q, setQ] = useState('');
  const today = todayKey();
  const list = useMemo(() => {
    const occ = eventsBetween(db.events, addDays(today, -30), addDays(today, 90));
    const query = q.trim().toLowerCase();
    return occ.filter((o) => !query || o.event.title.toLowerCase().includes(query));
  }, [db.events, q, today]);
  const firstUpcoming = list.findIndex((o) => o.date >= today);
  const ordered = firstUpcoming > 0 ? [...list.slice(firstUpcoming), ...list.slice(0, firstUpcoming).reverse()] : list;

  return (
    <Sheet visible={visible} onClose={onClose} title={tr('Lier à un événement')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, borderRadius: 14, paddingHorizontal: 12, marginBottom: 12, backgroundColor: t.card }}>
        <Feather name="search" size={15} color={t.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={tr('Rechercher…')} placeholderTextColor={t.muted} style={{ flex: 1, fontFamily: t.font.regular, color: t.ink, paddingVertical: 10 }} />
      </View>
      <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
        {ordered.length === 0 ? (
          <Txt v="body" color={t.muted} style={{ textAlign: 'center', paddingVertical: 24 }}>
            {tr('Aucun événement entre il y a 30 jours et dans 90 jours.')}
          </Txt>
        ) : (
          ordered.map((o) => (
            <Pressable
              key={o.event.id + o.date}
              onPress={() => {
                tap();
                onPick(o.event.id, o.date);
                onClose();
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 4,
                borderBottomWidth: StyleSheet.hairlineWidth * 2,
                borderColor: t.line,
                backgroundColor: pressed ? t.bgAlt : 'transparent',
                opacity: o.date < today ? 0.55 : 1,
              })}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.swatch(o.event.color) }} />
              <View style={{ flex: 1 }}>
                <Txt v="body" numberOfLines={1}>
                  {o.event.title}
                </Txt>
                <Txt v="small" color={t.muted}>
                  {formatShort(o.date)}
                  {o.event.allDay ? '' : ` · ${o.event.start}`}
                </Txt>
              </View>
              <Feather name="link-2" size={15} color={t.muted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </Sheet>
  );
}

export function LinkedEventChip({ eventId, date, onUnlink, onPick }: { eventId?: string; date?: string; onUnlink: () => void; onPick: () => void }) {
  const t = useTheme();
  const { db } = useStore();
  const ev = eventId ? db.events.find((e) => e.id === eventId) : undefined;
  if (!ev) {
    return <Btn label={tr('Lier à un événement')} icon="link-2" kind="plain" small onPress={onPick} style={{ alignSelf: 'flex-start' }} />;
  }
  const fg = t.onSwatch(ev.color);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12, backgroundColor: t.swatch(ev.color) }}>
      <Feather name="calendar" size={17} color={fg} />
      <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/event/[id]', params: { id: ev.id, date: date ?? ev.date } })}>
        <Txt v="bodyB" color={fg} numberOfLines={1}>
          {ev.title}
        </Txt>
        <Txt v="small" color={fg} style={{ opacity: 0.8 }}>
          {formatShort(date ?? ev.date)}
          {ev.allDay ? '' : ` · ${ev.start}`}
        </Txt>
      </Pressable>
      <IconBtn icon="link-2" label={tr('Changer d’événement')} onPress={onPick} size={34} />
      <IconBtn icon="x" label={tr('Délier')} onPress={onUnlink} size={34} />
    </View>
  );
}
