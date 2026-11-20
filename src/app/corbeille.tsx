import Feather from '@expo/vector-icons/Feather';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { close, EditorShell } from '../components/editor';
import { Btn, Empty, IconName, success, tap, Txt } from '../components/ui';
import { useStore } from '../data/store';
import { TrashItem } from '../data/types';
import { formatShort } from '../lib/date';
import { tr } from '../i18n';
import { useTheme } from '../theme';

// ゴミ箱 — la corbeille : ce qui a été supprimé reste 30 jours, restaurable d'un geste.

function describeItem(x: TrashItem): { icon: IconName; kind: string; title: string; sub?: string } {
  if (x.kind === 'note') return { icon: 'feather', kind: 'Note', title: x.item.title || x.item.body.split('\n')[0] || tr('Note sans titre'), sub: x.item.photos?.length ? `${x.item.photos.length} photo(s)` : undefined };
  if (x.kind === 'task') return { icon: 'check-square', kind: tr('Tâche'), title: x.item.title, sub: x.item.due ? formatShort(x.item.due) : undefined };
  return { icon: 'calendar', kind: tr('Événement'), title: x.item.title, sub: formatShort(x.item.date) };
}

const daysLeft = (x: TrashItem) => Math.max(0, 30 - Math.floor((Date.now() - x.deletedAt) / 86400000));

export default function Corbeille() {
  const t = useTheme();
  const { db, restoreFromTrash, deleteForever, emptyTrash } = useStore();
  const items = db.trash;

  return (
    <EditorShell kicker={tr('Corbeille')} jp="ゴミ箱" onSave={close} saveLabel={tr('Fini')} closeLabel={tr('Fermer')}>
      <Txt v="small" color={t.muted} style={{ marginBottom: 16 }}>
        {tr('Ce que tu supprimes reste ici 30 jours, puis part pour de bon. Touche un élément pour le remettre à sa place.')}
      </Txt>
      {items.length === 0 ? (
        <Empty jp="空" title={tr('Corbeille vide.')} hint={tr('Rien n’a été supprimé ces 30 derniers jours.')} />
      ) : (
        <>
          {items.map((x) => {
            const d = describeItem(x);
            const left = daysLeft(x);
            return (
              <View
                key={x.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  marginBottom: 8,
                  borderRadius: 18,
                  borderWidth: StyleSheet.hairlineWidth * 2,
                  borderColor: t.line,
                  backgroundColor: t.card,
                }}
              >
                <Feather name={d.icon} size={17} color={t.accent} />
                <View style={{ flex: 1 }}>
                  <Txt v="body" numberOfLines={1}>
                    {d.title}
                  </Txt>
                  <Txt v="small" color={t.muted} numberOfLines={1} style={{ fontSize: 11.5 }}>
                    {d.kind}
                    {d.sub ? ` · ${d.sub}` : ''} · {left ? tr('encore {n} j', { n: left }) : tr('part aujourd’hui')}
                  </Txt>
                </View>
                <Pressable
                  onPress={() => {
                    success();
                    restoreFromTrash(x.id);
                  }}
                  accessibilityLabel={tr('Restaurer {title}', { title: d.title })}
                  hitSlop={6}
                  style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: pressed ? t.accent : t.accentSoft })}
                >
                  <Txt v="small" color={t.ink} style={{ fontFamily: t.font.medium }}>
                    {tr('Restaurer')}
                  </Txt>
                </Pressable>
                <Pressable
                  onPress={() => {
                    tap();
                    Alert.alert(tr('Supprimer définitivement ?'), d.title, [
                      { text: tr('Annuler'), style: 'cancel' },
                      { text: tr('Supprimer'), style: 'destructive', onPress: () => deleteForever(x.id) },
                    ]);
                  }}
                  accessibilityLabel={tr('Supprimer définitivement {title}', { title: d.title })}
                  hitSlop={8}
                >
                  <Feather name="x" size={17} color={t.muted} />
                </Pressable>
              </View>
            );
          })}
          <Btn
            label={tr('Vider la corbeille')}
            icon="trash-2"
            kind="danger"
            style={{ alignSelf: 'center', marginTop: 14 }}
            onPress={() =>
              Alert.alert(tr('Vider la corbeille ?'), tr('{n} élément(s) seront supprimés définitivement.', { n: items.length }), [
                { text: tr('Annuler'), style: 'cancel' },
                { text: tr('Vider'), style: 'destructive', onPress: emptyTrash },
              ])
            }
          />
        </>
      )}
    </EditorShell>
  );
}
