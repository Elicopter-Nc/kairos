import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Alert, Linking, Pressable, ScrollView, Share, TextInput, View } from 'react-native';
import { close, EditorShell, EventPicker, Label, LinkedEventChip, PickField } from '../../components/editor';
import { LinkPreviews } from '../../components/LinkPreview';
import { PhotoViewer } from '../../components/PhotoViewer';
import { TagEditor } from '../../components/TagEditor';
import { Card, Check, Chip, IconBtn, SwatchPicker, success, tap, Txt } from '../../components/ui';
import { newId, useStore } from '../../data/store';
import { Note } from '../../data/types';
import { findUrls, splitLinks } from '../../lib/linkPreview';
import { deletePhotos, PermissionError, pickPhotos, takePhoto } from '../../lib/photos';
import { allTags } from '../../lib/tags';
import { addDays, capitalize, formatLong, todayKey } from '../../lib/date';
import { pickDate, pickTime } from '../../lib/pickers';
import { tr } from '../../i18n';
import { useTheme } from '../../theme';

/** Texte où les liens sont soulignés et cliquables. */
function Linked({ text, color, accent }: { text: string; color: string; accent: string }) {
  const parts = splitLinks(text);
  if (parts.length === 1 && !parts[0].url) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.url ? (
          <Txt
            key={i}
            color={accent}
            style={{ textDecorationLine: 'underline' }}
            onPress={() => {
              tap();
              Linking.openURL(p.url!).catch(() => {});
            }}
          >
            {p.text}
          </Txt>
        ) : (
          <Txt key={i} color={color}>
            {p.text}
          </Txt>
        ),
      )}
    </>
  );
}

const CHECK_RE = /^(\s*)[-*] \[( |x|X)\] ?(.*)$/;

export default function NoteEditor() {
  const t = useTheme();
  const params = useLocalSearchParams<{ id: string; eventId?: string; eventDate?: string }>();
  const { db, upsertNote, deleteNote } = useStore();
  const existing = db.notes.find((n) => n.id === params.id);
  const [picker, setPicker] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [reading, setReading] = useState(() => !!existing && existing.body.split('\n').some((l) => CHECK_RE.test(l)));

  const [note, setNote] = useState<Note>(
    () =>
      existing ?? {
        id: newId(),
        title: '',
        body: '',
        color: params.eventId ? 'ciel' : 'soleil',
        pinned: false,
        eventId: params.eventId || undefined,
        eventDate: params.eventDate || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
  );
  const set = (p: Partial<Note>) => setNote((n) => ({ ...n, ...p }));

  // Sauvegarde automatique à la fermeture (bouton retour Android compris)
  const latest = useRef(note);
  const handled = useRef(false);
  useEffect(() => {
    latest.current = note;
  }, [note]);
  useEffect(
    () => () => {
      if (handled.current) return;
      const n = latest.current;
      const changed = !existing || JSON.stringify(n) !== JSON.stringify(existing);
      if (changed && hasContent(n)) upsertNote({ ...n, updatedAt: Date.now() });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const save = () => {
    handled.current = true;
    if (hasContent(note)) upsertNote({ ...note, updatedAt: Date.now() });
    close();
  };

  const remove = () =>
    Alert.alert(tr('Supprimer la note ?'), `${note.title || note.body.slice(0, 60)}\n\n${tr('Elle reste 30 jours dans la corbeille.')}`, [
      { text: tr('Annuler'), style: 'cancel' },
      {
        text: tr('Supprimer'),
        style: 'destructive',
        onPress: () => {
          handled.current = true;
          // la note part à la corbeille avec ses photos enregistrées ;
          // les photos ajoutées dans cette session et jamais enregistrées sont effacées
          const kept = new Set(existing?.photos ?? []);
          deletePhotos((note.photos ?? []).filter((u) => !kept.has(u)));
          if (existing) deleteNote(note.id);
          close();
        },
      },
    ]);

  const addChecklistLine = () => {
    tap();
    const sep = note.body && !note.body.endsWith('\n') ? '\n' : '';
    set({ body: `${note.body}${sep}- [ ] ` });
    setReading(false);
  };

  const photos = note.photos ?? [];
  const linkColor = t.dark ? t.accent : t.inkSoft;
  // on attend une pause dans la frappe avant de chercher les liens (évite « https://exa… »)
  const [linkBody, setLinkBody] = useState(note.body);
  useEffect(() => {
    const id = setTimeout(() => setLinkBody(note.body), reading ? 0 : 1200);
    return () => clearTimeout(id);
  }, [note.body, reading]);
  const urls = findUrls(linkBody);

  const addPhotos = async (source: 'camera' | 'galerie') => {
    try {
      const uris = source === 'camera' ? await takePhoto() : await pickPhotos();
      if (!uris.length) return;
      success();
      setNote((n) => ({ ...n, photos: [...(n.photos ?? []), ...uris] }));
    } catch (e) {
      Alert.alert(tr('Photo impossible'), e instanceof PermissionError ? tr('{msg} Autorise-le dans les réglages Android.', { msg: e.message }) : String((e as Error).message ?? e));
    }
  };

  const askPhoto = () => {
    tap();
    Alert.alert(tr('Ajouter une photo'), undefined, [
      { text: tr('Annuler'), style: 'cancel' },
      { text: tr('Galerie'), onPress: () => addPhotos('galerie') },
      { text: tr('Appareil photo'), onPress: () => addPhotos('camera') },
    ]);
  };

  const removePhoto = (uri: string) =>
    Alert.alert(tr('Retirer cette photo ?'), tr('Elle sera supprimée du téléphone.'), [
      { text: tr('Annuler'), style: 'cancel' },
      {
        text: tr('Retirer'),
        style: 'destructive',
        onPress: () => {
          deletePhotos([uri]);
          setNote((n) => ({ ...n, photos: (n.photos ?? []).filter((p) => p !== uri) }));
        },
      },
    ]);

  const toggleLine = (index: number) => {
    const lines = note.body.split('\n');
    const m = lines[index].match(CHECK_RE);
    if (!m) return;
    const checked = m[2].toLowerCase() === 'x';
    lines[index] = `${m[1]}- [${checked ? ' ' : 'x'}] ${m[3]}`;
    set({ body: lines.join('\n') });
  };

  const bg = t.swatch(note.color);
  const fg = t.onSwatch(note.color);
  const lines = note.body.split('\n');
  const checks = lines.filter((l) => CHECK_RE.test(l));
  const checked = checks.filter((l) => /\[(x|X)\]/.test(l)).length;

  return (
    <EditorShell
      kicker={existing ? tr('Note') : tr('Nouvelle note')}
      onSave={save}
      saveLabel="OK"
      jp="覚え書き"
      closeLabel={tr('Fermer (enregistré automatiquement)')}
      extraActions={
        <>
          <IconBtn
            icon="share"
            label={tr('Partager')}
            size={40}
            onPress={() => Share.share({ message: [note.title, note.body].filter(Boolean).join('\n\n') })}
          />
          {existing ? <IconBtn icon="trash-2" label={tr('Supprimer')} onPress={remove} size={40} /> : null}
        </>
      }
    >
      <Card bg={bg} bordered={false} radius={24} contentStyle={{ padding: 18, minHeight: 360 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            value={note.title}
            onChangeText={(title) => set({ title })}
            placeholder={tr('Titre')}
            placeholderTextColor={fg + '88'}
            selectionColor={fg + '45'}
            cursorColor={fg}
            selectionHandleColor={fg}
            multiline
            style={{ flex: 1, fontFamily: t.font.mincho, fontSize: 28, lineHeight: 36, color: fg, paddingVertical: 2 }}
          />
          <Pressable
            onPress={() => {
              tap();
              set({ pinned: !note.pinned });
            }}
            hitSlop={10}
            accessibilityLabel={note.pinned ? tr('Désépingler') : tr('Épingler')}
          >
            <Feather name="bookmark" size={22} color={fg} style={{ opacity: note.pinned ? 1 : 0.35 }} />
          </Pressable>
        </View>
        {checks.length ? (
          <Txt v="kicker" color={fg} style={{ opacity: 0.7, marginTop: 2, fontSize: 10 }}>
            {tr('{checked}/{total} cochées', { checked, total: checks.length })}
          </Txt>
        ) : null}
        <View style={{ height: 1, backgroundColor: fg, opacity: 0.2, marginVertical: 12 }} />

        {reading ? (
          <Pressable onLongPress={() => setReading(false)} style={{ gap: 6 }}>
            {lines.map((line, i) => {
              const m = line.match(CHECK_RE);
              if (m) {
                const done = m[2].toLowerCase() === 'x';
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: m[1].length * 6 }}>
                    <Check size={22} done={done} onPress={() => toggleLine(i)} />
                    <Txt v="body" color={fg} style={{ flex: 1, textDecorationLine: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
                      <Linked text={m[3]} color={fg} accent={linkColor} />
                    </Txt>
                  </View>
                );
              }
              if (line.startsWith('# ')) {
                return (
                  <Txt key={i} v="h2" color={fg} style={{ marginTop: 6 }}>
                    {line.slice(2)}
                  </Txt>
                );
              }
              return (
                <Txt key={i} v="body" color={fg} style={{ fontSize: 16, lineHeight: 23 }}>
                  {line ? <Linked text={line} color={fg} accent={linkColor} /> : ' '}
                </Txt>
              );
            })}
          </Pressable>
        ) : (
          <TextInput
            value={note.body}
            onChangeText={(body) => set({ body })}
            placeholder={tr('Écris ici…\n\nAstuce : « - [ ] » crée une case à cocher, « # » un titre.')}
            placeholderTextColor={fg + '88'}
            selectionColor={fg + '45'}
            cursorColor={fg}
            selectionHandleColor={fg}
            multiline
            autoFocus={!existing}
            textAlignVertical="top"
            style={{ fontFamily: t.font.regular, fontSize: 16, lineHeight: 23, color: fg, minHeight: 260, padding: 0 }}
          />
        )}
      </Card>

      <LinkPreviews urls={urls} enabled={db.settings.linkPreviews} />

      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, marginHorizontal: -20 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
          {photos.map((uri, i) => (
            <Pressable
              key={uri}
              onPress={() => setViewer(i)}
              onLongPress={() => removePhoto(uri)}
              delayLongPress={350}
              accessibilityLabel={tr('Photo {n}. Appui long pour la retirer', { n: i + 1 })}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}
            >
              <Image source={{ uri }} style={{ width: 96, height: 96, borderRadius: 16, backgroundColor: t.bgAlt }} contentFit="cover" transition={150} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <Chip label={reading ? tr('Modifier') : tr('Lecture')} icon={reading ? 'edit-3' : 'eye'} active={reading} onPress={() => setReading(!reading)} />
        <Chip label={tr('Case à cocher')} icon="check-square" onPress={addChecklistLine} />
        <Chip label="Photo" icon="camera" onPress={askPhoto} />
      </View>

      <Label jp="札">Tags</Label>
      <TagEditor tags={note.tags ?? []} known={allTags([...db.notes, ...db.tasks]).map((x) => x.tag)} onChange={(tags) => set({ tags: tags.length ? tags : undefined })} />

      <Label jp="鈴">{tr('Rappel')}</Label>
      <NoteReminder value={note.remindAt} onChange={(remindAt) => set({ remindAt })} />

      <Label jp="色">{tr('Couleur')}</Label>
      <SwatchPicker value={note.color} onChange={(color) => set({ color })} />

      <Label jp="予定">{tr('Événement lié')}</Label>
      <LinkedEventChip
        eventId={note.eventId}
        date={note.eventDate}
        onPick={() => setPicker(true)}
        onUnlink={() => set({ eventId: undefined, eventDate: undefined })}
      />
      <EventPicker visible={picker} onClose={() => setPicker(false)} onPick={(eventId, eventDate) => set({ eventId, eventDate })} />
      {viewer !== null ? <PhotoViewer photos={photos} index={viewer} onClose={() => setViewer(null)} /> : null}
    </EditorShell>
  );
}

function hasContent(n: Note) {
  return !!(n.title.trim() || n.body.trim() || n.photos?.length);
}

/** Rappel ponctuel d'une note : raccourcis + choix libre de la date et de l'heure. */
function NoteReminder({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
  const today = todayKey();
  const [opened] = useState(() => new Date()); // heure d'ouverture de l'éditeur
  const hour = opened.getHours();
  const day = value?.slice(0, 10);
  const time = value?.slice(11, 16);
  const past = !!value && new Date(value).getTime() <= opened.getTime();
  const choose = async () => {
    const d = await pickDate(day ?? today);
    if (!d) return;
    const t = await pickTime(time ?? '09:00', d);
    if (t) onChange(`${d}T${t}`);
  };
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Chip label={tr('Aucun')} active={!value} onPress={() => onChange(undefined)} />
        {hour < 18 ? (
          <Chip
            label={tr('Ce soir 18 h')}
            active={value === `${today}T18:00`}
            onPress={() => onChange(`${today}T18:00`)}
          />
        ) : null}
        <Chip label={tr('Demain 9 h')} active={value === `${addDays(today, 1)}T09:00`} onPress={() => onChange(`${addDays(today, 1)}T09:00`)} />
        <Chip label={tr('Choisir…')} icon="calendar" onPress={choose} />
      </View>
      {value ? (
        <PickField
          icon="bell"
          label={past ? tr('Rappel passé') : tr('Rappel')}
          value={tr('{date} à {time}', { date: capitalize(formatLong(day!)), time: time ?? '' })}
          placeholder=""
          onPress={choose}
          onClear={() => onChange(undefined)}
        />
      ) : null}
    </View>
  );
}
