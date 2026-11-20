import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { tr } from '../i18n';
import { uid } from './date';

// Les photos des notes sont copiées dans le dossier privé de l'app
// (documents/photos). Elles ne quittent jamais le téléphone.

const QUALITY = 0.8;

function photosDir(): Directory {
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

async function keep(assets: ImagePicker.ImagePickerAsset[]): Promise<string[]> {
  const dir = photosDir();
  const out: string[] = [];
  for (const a of assets) {
    const src = new File(a.uri);
    const ext = (a.fileName?.split('.').pop() || src.extension.replace('.', '') || 'jpg').toLowerCase();
    const dest = new File(dir, `${uid()}.${ext === 'jpeg' ? 'jpg' : ext}`);
    await src.copy(dest);
    out.push(dest.uri);
  }
  return out;
}

export class PermissionError extends Error {}

/** Prend une photo avec l'appareil. Renvoie les URI copiées (vide si annulé). */
export async function takePhoto(): Promise<string[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new PermissionError(tr("Kairos n'a pas accès à l'appareil photo."));
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: QUALITY, exif: false });
  if (res.canceled) return [];
  return keep(res.assets);
}

/** Choisit une ou plusieurs photos dans la galerie. */
export async function pickPhotos(limit = 10): Promise<string[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: QUALITY,
    allowsMultipleSelection: true,
    selectionLimit: limit,
    exif: false,
  });
  if (res.canceled) return [];
  return keep(res.assets);
}

/** Supprime les fichiers photo (ignore ceux qui n'existent plus). */
export function deletePhotos(uris: string[] | undefined) {
  for (const uri of uris ?? []) {
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch {
      /* fichier déjà absent */
    }
  }
}
