import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { cleanTag } from '../lib/tags';
import { tr, trn } from '../i18n';
import { useTheme } from '../theme';
import { tap, Txt } from './ui';

/**
 * Tags d'une note : les tags posés (touche × pour retirer), un champ pour en créer
 * un nouveau (Entrée, espace ou virgule pour valider) et les tags déjà utilisés
 * ailleurs, à ajouter d'un geste.
 */
export function TagEditor({ tags, known, onChange }: { tags: string[]; known: string[]; onChange: (tags: string[]) => void }) {
  const t = useTheme();
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const tag = cleanTag(raw);
    setDraft('');
    if (!tag || tags.includes(tag)) return;
    tap();
    onChange([...tags, tag]);
  };
  const suggestions = known.filter((k) => !tags.includes(k) && (!draft || k.startsWith(cleanTag(draft)))).slice(0, 12);

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {tags.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => {
              tap();
              onChange(tags.filter((x) => x !== tag));
            }}
            accessibilityLabel={tr('Retirer le tag {tag}', { tag })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: t.accentSoft }}
          >
            <Txt v="small" color={t.ink} style={{ fontFamily: t.font.medium }}>
              #{tag}
            </Txt>
            <Feather name="x" size={12} color={t.inkSoft} />
          </Pressable>
        ))}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 12,
            borderRadius: 999,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: t.line,
            borderStyle: 'dashed',
            minWidth: 130,
          }}
        >
          <Txt v="small" color={t.muted}>
            #
          </Txt>
          <TextInput
            value={draft}
            onChangeText={(v) => {
              // espace ou virgule en fin de saisie = valider le tag
              if (/[\s,;]$/.test(v) && v.trim()) add(v);
              else setDraft(v);
            }}
            onSubmitEditing={() => add(draft)}
            onBlur={() => draft.trim() && add(draft)}
            submitBehavior="submit"
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={tags.length ? tr('autre tag') : tr('nouveau tag')}
            placeholderTextColor={t.muted}
            selectionColor={t.selection}
            cursorColor={t.accent}
            selectionHandleColor={t.accent}
            accessibilityLabel={tr('Ajouter un tag')}
            style={{ flex: 1, minWidth: 90, fontFamily: t.font.regular, fontSize: 13.5, color: t.ink, paddingVertical: 6 }}
          />
        </View>
      </View>
      {suggestions.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -20 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 20 }}>
          {suggestions.map((k) => (
            <Pressable
              key={k}
              onPress={() => add(k)}
              accessibilityLabel={tr('Ajouter le tag {tag}', { tag: k })}
              style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: t.line }}
            >
              <Txt v="small" color={t.inkSoft}>
                + #{k}
              </Txt>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

/** Tag filtrant : touche = filtrer, appui long = le retirer partout. */
export function TagChip({ name, count, active, onPress, onLongPress }: { name: string; count: number; active: boolean; onPress: () => void; onLongPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={trn(count, 'Tag {name}, {n} élément. Appui long pour le supprimer', 'Tag {name}, {n} éléments. Appui long pour le supprimer', { name })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth * 2,
        borderColor: active ? t.accent : t.line,
        backgroundColor: active ? t.accent : 'transparent',
      }}
    >
      <Txt v="small" color={active ? t.onAccent : t.inkSoft} style={{ fontFamily: active ? t.font.medium : t.font.regular }}>
        #{name}
      </Txt>
      <Txt v="small" color={active ? t.onAccent : t.muted} style={{ fontSize: 10.5, opacity: 0.8 }}>
        {count}
      </Txt>
    </Pressable>
  );
}
