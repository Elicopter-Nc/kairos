import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { ComponentProps, ReactNode } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tr } from '../i18n';
import { Swatch } from '../data/types';
import { SWATCH_ORDER, SWATCHES, useTheme } from '../theme';
import { Komorebi } from './Komorebi';

export type IconName = ComponentProps<typeof Feather>['name'];

export const tap = () => Haptics.selectionAsync().catch(() => {});
export const thud = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

const GRAIN = require('../../assets/grain.png');

// ─── Texte ────────────────────────────────────────────────────────────────
type Variant = 'display' | 'title' | 'h2' | 'body' | 'bodyB' | 'small' | 'kicker' | 'num' | 'jp';

export function Txt({ v = 'body', color, style, ...rest }: TextProps & { v?: Variant; color?: string; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  const base: Record<Variant, TextStyle> = {
    display: { fontFamily: t.font.mincho, fontSize: 46, lineHeight: 54, letterSpacing: -0.5 },
    title: { fontFamily: t.font.mincho, fontSize: 26, lineHeight: 34 },
    h2: { fontFamily: t.font.mincho, fontSize: 18, lineHeight: 25 },
    body: { fontFamily: t.font.regular, fontSize: 15, lineHeight: 22 },
    bodyB: { fontFamily: t.font.medium, fontSize: 15, lineHeight: 22 },
    small: { fontFamily: t.font.regular, fontSize: 12.5, lineHeight: 18 },
    kicker: { fontFamily: t.font.medium, fontSize: 10.5, letterSpacing: 2, textTransform: 'uppercase' },
    num: { fontFamily: t.font.mincho, fontSize: 15, fontVariant: ['tabular-nums'] },
    jp: { fontFamily: t.font.mincho, fontSize: 13, letterSpacing: 2 },
  };
  return <Text {...rest} style={[base[v], { color: color ?? t.ink }, style]} />;
}

// ─── Carte : feuille de papier posée, filet fin, aucune ombre dure ───────
export function Card({
  children,
  bg,
  radius = 18,
  style,
  contentStyle,
  onPress,
  onLongPress,
  haptic = true,
  disabled,
  bordered = true,
  accessibilityLabel,
}: {
  children?: ReactNode;
  bg?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  haptic?: boolean;
  disabled?: boolean;
  bordered?: boolean;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const surface: ViewStyle = {
    backgroundColor: bg ?? t.card,
    borderRadius: radius,
    borderWidth: bordered ? StyleSheet.hairlineWidth * 2 : 0,
    borderColor: t.line,
    opacity: disabled ? 0.5 : 1,
  };
  if (!onPress && !onLongPress) return <View style={[style, surface, contentStyle]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPressIn={haptic ? tap : undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [style, surface, { transform: [{ scale: pressed ? 0.985 : 1 }] }, pressed && { opacity: 0.88 }, contentStyle]}
    >
      {children}
    </Pressable>
  );
}

// ─── Bouton ───────────────────────────────────────────────────────────────
export function Btn({
  label,
  icon,
  onPress,
  kind = 'accent',
  small,
  style,
  disabled,
}: {
  label?: string;
  icon?: IconName;
  onPress: () => void;
  kind?: 'accent' | 'soft' | 'plain' | 'ink' | 'danger';
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const t = useTheme();
  const bg = { accent: t.accent, soft: t.accentSoft, plain: t.card, ink: t.ink, danger: t.kaki }[kind];
  const fg = { accent: t.onAccent, soft: t.ink, plain: t.ink, ink: t.bg, danger: t.onAccent }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPressIn={tap}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: bg,
          borderRadius: 999,
          borderWidth: kind === 'plain' ? StyleSheet.hairlineWidth * 2 : 0,
          borderColor: t.line,
          paddingHorizontal: small ? 14 : 20,
          paddingVertical: small ? 8 : 13,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {icon ? <Feather name={icon} size={small ? 15 : 17} color={fg} /> : null}
      {label ? (
        <Txt v="bodyB" color={fg} style={{ fontSize: small ? 13 : 15 }}>
          {label}
        </Txt>
      ) : null}
    </Pressable>
  );
}

// ─── Pastille / filtre ────────────────────────────────────────────────────
export function Chip({ label, active, onPress, color, icon }: { label: string; active?: boolean; onPress?: () => void; color?: string; icon?: IconName }) {
  const t = useTheme();
  const bg = active ? color ?? t.accentSoft : 'transparent';
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 13,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: active ? bg : t.line,
        backgroundColor: bg,
      }}
    >
      {icon ? <Feather name={icon} size={13} color={active ? t.ink : t.muted} /> : null}
      <Txt v="small" color={active ? t.ink : t.inkSoft} style={{ fontFamily: active ? t.font.medium : t.font.regular }}>
        {label}
      </Txt>
    </Pressable>
  );
}

// ─── Case à cocher ────────────────────────────────────────────────────────
export function Check({ done, onPress, size = 22, color }: { done: boolean; onPress: () => void; size?: number; color?: string }) {
  const t = useTheme();
  return (
    <Pressable
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      onPress={() => {
        if (!done) success();
        else tap();
        onPress();
      }}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.26,
        borderWidth: done ? 0 : 1.3,
        borderColor: t.inkSoft,
        backgroundColor: done ? color ?? t.accent : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {done ? <Feather name="check" size={size * 0.68} color={t.onAccent} /> : null}
    </Pressable>
  );
}

// ─── Icône ronde ──────────────────────────────────────────────────────────
export function IconBtn({ icon, onPress, bg, size = 40, label, color }: { icon: IconName; onPress: () => void; bg?: string; size?: number; label: string; color?: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: t.line,
        backgroundColor: bg ?? t.card,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Feather name={icon} size={size * 0.44} color={color ?? t.ink} />
    </Pressable>
  );
}

// ─── Grain de papier washi ────────────────────────────────────────────────
export function Grain() {
  const t = useTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={GRAIN} resizeMode="repeat" style={{ width: '100%', height: '100%', opacity: t.dark ? 0.07 : 0.06 }} />
    </View>
  );
}

// ─── Écran ────────────────────────────────────────────────────────────────
export function Screen({
  children,
  komorebi = false,
  komorebiHeight = 420,
  padBottom = 110,
}: {
  children: ReactNode;
  komorebi?: boolean;
  komorebiHeight?: number;
  padBottom?: number;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: padBottom, paddingHorizontal: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {komorebi ? <Komorebi height={komorebiHeight + insets.top} /> : null}
        {children}
      </ScrollView>
      <Grain />
    </View>
  );
}

export function Header({ kicker, title, jp, right }: { kicker?: string; title: string; jp?: string; right?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20, marginTop: 8 }}>
      <View style={{ flex: 1 }}>
        {kicker ? (
          <Txt v="kicker" color={t.muted} style={{ marginBottom: 4 }}>
            {kicker}
          </Txt>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
          <Txt v="display">{title}</Txt>
          {jp ? (
            <Txt v="jp" color={t.accent}>
              {jp}
            </Txt>
          ) : null}
        </View>
      </View>
      {right}
    </View>
  );
}

/** Titre de section : mot japonais + titre français + filet fin. */
export function Section({ jp, title, right, children, style }: { jp?: string; title: string; right?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{ marginTop: 30 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 }}>
        {jp ? (
          <Txt v="jp" color={t.accent} style={{ fontSize: 14 }}>
            {jp}
          </Txt>
        ) : null}
        <Txt v="h2" style={{ fontSize: 16 }}>
          {title}
        </Txt>
        <View style={{ flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: t.line }} />
        {right}
      </View>
      {children}
    </View>
  );
}

// ─── Champ texte ──────────────────────────────────────────────────────────
export function Field({ label, style, big, ...rest }: TextInputProps & { label?: string; big?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      {label ? (
        <Txt v="kicker" color={t.muted} style={{ marginBottom: 6 }}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        placeholderTextColor={t.muted}
        selectionColor={t.selection}
        cursorColor={t.accent}
        selectionHandleColor={t.accent}
        {...rest}
        style={[
          big
            ? {
                fontFamily: t.font.mincho,
                fontSize: 28,
                lineHeight: 36,
                color: t.ink,
                paddingVertical: 6,
                borderBottomWidth: StyleSheet.hairlineWidth * 2,
                borderColor: t.line,
              }
            : {
                fontFamily: t.font.regular,
                fontSize: 15.5,
                color: t.ink,
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: t.line,
                borderRadius: 14,
                backgroundColor: t.card,
                paddingHorizontal: 14,
                paddingVertical: 12,
                textAlignVertical: rest.multiline ? 'top' : 'center',
              },
          style,
        ]}
      />
    </View>
  );
}

// ─── Ligne de réglage ─────────────────────────────────────────────────────
export function Row({ icon, label, value, onPress, right, danger }: { icon: IconName; label: string; value?: string; onPress?: () => void; right?: ReactNode; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              tap();
              onPress();
            }
          : undefined
      }
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: pressed ? t.bgAlt : 'transparent' })}
    >
      <Feather name={icon} size={17} color={danger ? t.kaki : t.accent} />
      <Txt v="body" style={{ flex: 1 }} color={danger ? t.kaki : t.ink}>
        {label}
      </Txt>
      {value ? (
        <Txt v="num" color={t.muted}>
          {value}
        </Txt>
      ) : null}
      {right ?? (onPress ? <Feather name="chevron-right" size={17} color={t.muted} /> : null)}
    </Pressable>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: t.line, marginLeft: 47 }} />;
}

// ─── Nuancier ─────────────────────────────────────────────────────────────
export function SwatchPicker({ value, onChange }: { value: Swatch; onChange: (s: Swatch) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {SWATCH_ORDER.map((s) => (
        <Pressable
          key={s}
          accessibilityLabel={tr(SWATCHES[s].label)}
          onPress={() => {
            tap();
            onChange(s);
          }}
          style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: value === s ? t.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: t.swatch(s), alignItems: 'center', justifyContent: 'center' }}>
            {value === s ? <Feather name="check" size={14} color={t.onSwatch(s)} /> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Bouton flottant ──────────────────────────────────────────────────────
export function Fab({ onPress, icon = 'plus', label }: { onPress: () => void; icon?: IconName; label: string }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={thud}
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        right: 20,
        bottom: 22,
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: t.accent,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#1C2318',
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Feather name={icon} size={24} color={t.onAccent} />
    </Pressable>
  );
}

// ─── Feuille modale ───────────────────────────────────────────────────────
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,26,18,0.35)' }]} onPress={onClose} />
      <View style={{ flex: 1 }} pointerEvents="box-none" />
      <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 18, maxHeight: '82%' }}>
        <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: t.line, marginBottom: 14 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Txt v="title" style={{ flex: 1 }}>
            {title}
          </Txt>
          <IconBtn icon="x" label={tr('Fermer')} onPress={onClose} size={36} />
        </View>
        {children}
      </View>
    </Modal>
  );
}

export function Empty({ title, hint, jp }: { title: string; hint?: string; jp?: string; icon?: IconName }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 30, gap: 6 }}>
      <View style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: t.line, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Txt v="jp" color={t.accent} style={{ fontSize: 16, letterSpacing: 0 }}>
          {jp ?? '空'}
        </Txt>
      </View>
      <Txt v="h2" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {hint ? (
        <Txt v="small" color={t.muted} style={{ textAlign: 'center', maxWidth: 260 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => {
        tap();
        onChange(!value);
      }}
      style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: value ? t.accent : t.line, padding: 3, justifyContent: 'center' }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.card, transform: [{ translateX: value ? 20 : 0 }] }} />
    </Pressable>
  );
}

/** Texte vertical (kanji empilés), lu de haut en bas. */
export function Vertical({ text, color, size = 14 }: { text: string; color?: string; size?: number }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', borderLeftWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line, paddingLeft: 8 }}>
      {[...text].map((c, i) => (
        <Txt key={i} v="jp" color={color ?? t.accent} style={{ fontSize: size, lineHeight: size * 1.35, letterSpacing: 0 }}>
          {c}
        </Txt>
      ))}
    </View>
  );
}
