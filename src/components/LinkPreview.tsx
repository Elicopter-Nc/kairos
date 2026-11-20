import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { domainOf, useLinkPreview } from '../lib/linkPreview';
import { tr } from '../i18n';
import { useTheme } from '../theme';
import { tap, Txt } from './ui';

const open = (url: string) => {
  tap();
  Linking.openURL(url).catch(() => {});
};

/** Carte d'aperçu d'un lien (titre, domaine, description, image). */
export function LinkPreview({ url, enabled }: { url: string; enabled: boolean }) {
  const t = useTheme();
  const { data, loading } = useLinkPreview(url, enabled);
  const domain = domainOf(url);

  // Échec, désactivé sans cache, ou rien d'utile : simple ligne avec le domaine
  if (!data?.ok && !loading) {
    return (
      <Pressable
        onPress={() => open(url)}
        accessibilityRole="link"
        accessibilityLabel={tr('Ouvrir {domain}', { domain })}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: pressed ? t.bgAlt : 'transparent', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line })}
      >
        <Feather name="link" size={13} color={t.accent} />
        <Txt v="small" color={t.inkSoft} numberOfLines={1} style={{ flex: 1 }}>
          {domain}
        </Txt>
        <Feather name="external-link" size={13} color={t.muted} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => open(url)}
      accessibilityRole="link"
      accessibilityLabel={tr('{title}, ouvrir le lien', { title: data?.title ?? domain })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: t.card,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: t.line,
        opacity: pressed ? 0.85 : 1,
        minHeight: 78,
      })}
    >
      {data?.image ? (
        <Image source={{ uri: data.image }} style={{ width: 84, backgroundColor: t.bgAlt }} contentFit="cover" transition={150} />
      ) : (
        <View style={{ width: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bgAlt }}>
          {loading ? (
            <ActivityIndicator size="small" color={t.accent} />
          ) : data?.icon ? (
            <Image source={{ uri: data.icon }} style={{ width: 20, height: 20 }} contentFit="contain" />
          ) : (
            <Feather name="link" size={16} color={t.accent} />
          )}
        </View>
      )}
      <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 2, justifyContent: 'center' }}>
        <Txt v="small" color={t.muted} numberOfLines={1} style={{ fontSize: 11 }}>
          {data?.siteName ?? domain}
        </Txt>
        <Txt style={{ fontFamily: t.font.mincho, fontSize: 15, lineHeight: 20, color: t.ink }} numberOfLines={2}>
          {loading && !data?.title ? tr('Lecture de la page…') : data?.title ?? domain}
        </Txt>
        {data?.description ? (
          <Txt v="small" color={t.inkSoft} numberOfLines={2} style={{ fontSize: 12 }}>
            {data.description}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Liste d'aperçus (3 au plus) pour les liens d'un texte. */
export function LinkPreviews({ urls, enabled }: { urls: string[]; enabled: boolean }) {
  if (!urls.length) return null;
  return (
    <View style={{ gap: 8, marginTop: 14 }}>
      {urls.slice(0, 3).map((u) => (
        <LinkPreview key={u} url={u} enabled={enabled} />
      ))}
    </View>
  );
}
