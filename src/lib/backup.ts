import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { DB } from '../data/types';
import { tr, trn } from '../i18n';
import { todayKey } from './date';

/** Nombre de photos attachées aux notes : elles ne sont PAS dans le fichier de sauvegarde. */
export function countPhotos(db: DB): number {
  return db.notes.reduce((n, note) => n + (note.photos?.length ?? 0), 0);
}

export async function exportBackup(db: DB): Promise<void> {
  const file = new File(Paths.cache, `kairos-sauvegarde-${todayKey()}.json`);
  if (file.exists) file.delete();
  file.create();
  const photos = countPhotos(db);
  const notice = photos
    ? trn(
        photos,
        "La photo des notes n'est pas incluse dans ce fichier : elle reste sur le téléphone d'origine.",
        "Les {n} photos des notes ne sont pas incluses dans ce fichier : elles restent sur le téléphone d'origine.",
      )
    : undefined;
  await file.write(JSON.stringify({ app: 'kairos', exportedAt: new Date().toISOString(), notice, data: db }, null, 2));
  if (!(await Sharing.isAvailableAsync())) throw new Error(tr('Partage indisponible sur cet appareil'));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: tr('Sauvegarder Kairos') });
}

export async function pickBackup(): Promise<{ data: unknown; counts: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const text = await new File(res.assets[0].uri).text();
  const parsed = JSON.parse(text);
  const data = parsed?.app === 'kairos' ? parsed.data : parsed;
  if (!data || typeof data !== 'object' || !Array.isArray((data as DB).tasks)) {
    throw new Error(tr("Ce fichier n'est pas une sauvegarde Kairos."));
  }
  const d = data as DB;
  // Les photos ne voyagent pas avec la sauvegarde : on retire celles dont le fichier est absent.
  let missing = 0;
  const notes = (d.notes ?? []).map((n) => {
    if (!n.photos?.length) return n;
    const kept = n.photos.filter((uri) => {
      try {
        return new File(uri).exists;
      } catch {
        return false;
      }
    });
    missing += n.photos.length - kept.length;
    return { ...n, photos: kept };
  });
  let counts = [
    trn(d.events?.length ?? 0, '{n} événement', '{n} événements'),
    trn(d.tasks.length, '{n} tâche', '{n} tâches'),
    trn(notes.length, '{n} note', '{n} notes'),
    trn(d.habits?.length ?? 0, '{n} rituel', '{n} rituels'),
  ].join(', ');
  if (missing) {
    counts +=
      ' ' +
      trn(
        missing,
        '({n} photo introuvable sur ce téléphone, elle sera retirée de sa note)',
        '({n} photos introuvables sur ce téléphone, elles seront retirées des notes)',
      );
  }
  return { data: { ...d, notes }, counts };
}
