import Feather from '@expo/vector-icons/Feather';
import { Linking, Pressable, View } from 'react-native';
import { useStore } from '../data/store';
import { restartWithUpdate, useAppUpdates } from '../lib/appUpdate';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { tap, Txt } from './ui';

/** Bandeau discret en haut de l'écran Jour quand une mise à jour attend. */
export function UpdateBanner() {
  const t = useTheme();
  const { db } = useStore();
  const { ota, apk, hideApk } = useAppUpdates(db.settings.updateCheck);
  if (!ota && !apk) return null;

  const title = ota ? tr('Mise à jour prête') : tr('Kairos {version} est sorti', { version: apk!.version });
  const hint = ota ? tr('Relance l’app pour en profiter.') : tr('Nouvel APK à installer par-dessus : tes données sont gardées.');
  const action = ota ? tr('Relancer') : tr('Télécharger');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 20, backgroundColor: t.accentSoft, marginBottom: 16 }}>
      <Feather name={ota ? 'refresh-cw' : 'download'} size={18} color={t.ink} />
      <View style={{ flex: 1 }}>
        <Txt v="bodyB" style={{ fontSize: 14.5 }}>
          {title}
        </Txt>
        <Txt v="small" color={t.inkSoft} style={{ fontSize: 12 }}>
          {hint}
        </Txt>
      </View>
      <Pressable
        onPress={() => {
          tap();
          if (ota) restartWithUpdate();
          else Linking.openURL(apk!.url).catch(() => {});
        }}
        accessibilityRole="button"
        style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: pressed ? t.ink : t.accent })}
      >
        <Txt v="small" color={t.onAccent} style={{ fontFamily: t.font.medium }}>
          {action}
        </Txt>
      </Pressable>
      {!ota ? (
        <Pressable onPress={hideApk} hitSlop={10} accessibilityLabel={tr('Ignorer cette version')}>
          <Feather name="x" size={16} color={t.inkSoft} />
        </Pressable>
      ) : null}
    </View>
  );
}
