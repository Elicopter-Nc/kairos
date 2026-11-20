import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Occurrence } from '../data/recurrence';
import { useStore } from '../data/store';
import { Note } from '../data/types';
import { formatShort, relativeLabel, toKey } from '../lib/date';
import { domainOf, findUrls, useLinkPreview } from '../lib/linkPreview';
import { trn } from '../i18n';
import { useTheme } from '../theme';
import { Card, Txt } from './ui';

function Meta({ icon, text, color }: { icon: React.ComponentProps<typeof Feather>['name']; text?: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 180 }}>
      <Feather name={icon} size={11} color={color} />
      {text ? (
        <Txt v="small" color={color} numberOfLines={1} style={{ fontSize: 12 }}>
          {text}
        </Txt>
      ) : null}
    </View>
  );
}

// TaskItem vit dans son propre fichier (gestes, animations)
export { TaskItem } from './TaskItem';

export function EventItem({ occ, showDate }: { occ: Occurrence; showDate?: boolean }) {
  const t = useTheme();
  const { db } = useStore();
  const { event, date } = occ;
  const notes = db.notes.filter((n) => n.eventId === event.id && (!n.eventDate || n.eventDate === date)).length;
  return (
    <Card
      style={{ marginBottom: 8 }}
      onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id, date } })}
      contentStyle={{ flexDirection: 'row', alignItems: 'stretch', paddingVertical: 12, paddingHorizontal: 14, gap: 12 }}
    >
      <View style={{ width: 46, justifyContent: 'center' }}>
        {event.allDay ? (
          <Txt v="jp" color={t.accent} style={{ fontSize: 12, letterSpacing: 1 }}>
            終日
          </Txt>
        ) : (
          <>
            <Txt v="num" color={t.accent} style={{ fontSize: 16 }}>
              {event.start}
            </Txt>
            {event.end ? (
              <Txt v="num" color={t.muted} style={{ fontSize: 12 }}>
                {event.end}
              </Txt>
            ) : null}
          </>
        )}
      </View>
      <View style={{ width: 3, borderRadius: 2, backgroundColor: t.swatch(event.color) }} />
      <View style={{ flex: 1, gap: 2, justifyContent: 'center' }}>
        {showDate ? (
          <Txt v="kicker" color={t.muted} style={{ fontSize: 9.5 }}>
            {relativeLabel(date)}
          </Txt>
        ) : null}
        <Txt v="body" numberOfLines={2}>
          {event.title}
        </Txt>
        {event.location || event.recurrence !== 'none' || event.reminder !== null || notes ? (
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {event.location ? <Meta icon="map-pin" text={event.location} color={event.geo ? t.accent : t.muted} /> : null}
            {event.geo && event.leaveAlert && !event.allDay ? <Meta icon="navigation" color={t.muted} /> : null}
            {event.recurrence !== 'none' ? <Meta icon="repeat" color={t.muted} /> : null}
            {event.reminder !== null ? <Meta icon="bell" color={t.muted} /> : null}
            {notes ? <Meta icon="feather" text={trn(notes, '{n} note', '{n} notes')} color={t.muted} /> : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export function NoteCard({ note }: { note: Note }) {
  const t = useTheme();
  const { db } = useStore();
  const ev = note.eventId ? db.events.find((e) => e.id === note.eventId) : undefined;
  const fg = t.onSwatch(note.color);
  // aperçu de lien : cache seulement (la liste ne fait jamais de requête)
  const link = findUrls(note.body)[0];
  const { data: linkData } = useLinkPreview(link, false);
  const preview = note.body
    .split('\n')
    .filter((l) => !/^\s*[-*] \[( |x|X)\]\s*$/.test(l)) // case à cocher sans texte
    .join('\n')
    .replace(/^\s*[-*] \[( |x|X)\] /gm, (m) => (/x/i.test(m) ? '☑ ' : '☐ '))
    .replace(/\n{2,}/g, '\n')
    .trim();
  return (
    <Card
      bg={t.swatch(note.color)}
      bordered={false}
      radius={20}
      style={{ marginBottom: 10 }}
      onPress={() => router.push(`/note/${note.id}`)}
      contentStyle={{ padding: 14, gap: 6 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
        {note.title ? (
          <Txt v="h2" color={fg} style={{ flex: 1, fontSize: 17, lineHeight: 23 }} numberOfLines={3}>
            {note.title}
          </Txt>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        {note.pinned ? <Feather name="bookmark" size={14} color={fg} /> : null}
      </View>
      {preview ? (
        <Txt v="small" color={fg} numberOfLines={7} style={{ fontSize: 13.5, lineHeight: 19, opacity: 0.85 }}>
          {preview}
        </Txt>
      ) : null}
      {link ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Feather name="link" size={11} color={fg} style={{ opacity: 0.7 }} />
          <Txt v="small" color={fg} numberOfLines={1} style={{ fontSize: 11, opacity: 0.75, flexShrink: 1 }}>
            {linkData?.ok && linkData.title ? linkData.title : domainOf(link)}
          </Txt>
        </View>
      ) : null}
      {note.tags?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
          {note.tags.slice(0, 4).map((tag) => (
            <View key={tag} style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999, backgroundColor: fg + '1A' }}>
              <Txt v="small" color={fg} numberOfLines={1} style={{ fontSize: 10.5, opacity: 0.85 }}>
                #{tag}
              </Txt>
            </View>
          ))}
          {note.tags.length > 4 ? (
            <Txt v="small" color={fg} style={{ fontSize: 10.5, opacity: 0.7 }}>
              +{note.tags.length - 4}
            </Txt>
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth * 2, borderColor: fg + '33', paddingTop: 7 }}>
        <Feather name={ev ? 'calendar' : 'clock'} size={11} color={fg} style={{ opacity: 0.7 }} />
        <Txt v="small" color={fg} numberOfLines={1} style={{ fontSize: 11, opacity: 0.75, flexShrink: 1 }}>
          {ev ? ev.title : formatShort(toKey(new Date(note.updatedAt)))}
        </Txt>
        {note.photos?.length ? (
          <>
            <View style={{ flex: 1 }} />
            <Feather name="image" size={11} color={fg} style={{ opacity: 0.7 }} accessibilityLabel={trn(note.photos.length, '{n} photo', '{n} photos')} />
            <Txt v="small" color={fg} style={{ fontSize: 11, opacity: 0.75 }}>
              {note.photos.length}
            </Txt>
          </>
        ) : null}
      </View>
    </Card>
  );
}
