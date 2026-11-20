import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// Deux sortes de mises à jour :
// 1. EAS Update : le code de l'app (écrans, corrections) se télécharge tout seul,
//    sans réinstaller l'APK. On propose de relancer quand c'est prêt.
// 2. Nouvel APK (widgets, permissions…) : on regarde la dernière release GitHub
//    (une requête anonyme, au plus deux fois par jour) et on propose le lien.

export const REPO = 'Elicopter-Nc/kairos';
const KEY = 'kairos:apk-check:v1';
const EVERY = 12 * 3600 * 1000;

export const appVersion = (): string => Constants.expoConfig?.version ?? '0.0.0';

/** « 1.10.0 » > « 1.9.2 » : comparaison numérique, partie par partie. */
export function newer(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}

export interface ApkRelease {
  version: string;
  url: string; // APK direct, ou la page de la release
  page: string;
}

interface Cache {
  checkedAt: number;
  latest: ApkRelease | null;
  dismissed?: string; // version que l'utilisateur a choisi d'ignorer
}

async function readCache(): Promise<Cache | null> {
  try {
    const s = await AsyncStorage.getItem(KEY);
    return s ? (JSON.parse(s) as Cache) : null;
  } catch {
    return null;
  }
}

export async function checkApk(force = false): Promise<ApkRelease | null> {
  const cache = await readCache();
  let latest = cache?.latest ?? null;
  if (force || !cache || Date.now() - cache.checkedAt > EVERY) {
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
      if (r.ok) {
        const j = (await r.json()) as { tag_name: string; html_url: string; assets?: { name: string; browser_download_url: string }[] };
        const apk = j.assets?.find((a) => a.name.endsWith('.apk'));
        latest = { version: j.tag_name.replace(/^v/, ''), url: apk?.browser_download_url ?? j.html_url, page: j.html_url };
        await AsyncStorage.setItem(KEY, JSON.stringify({ ...cache, checkedAt: Date.now(), latest }));
      }
    } catch {
      // hors-ligne : on garde le dernier résultat connu
    }
  }
  if (!latest || !newer(latest.version, appVersion())) return null;
  if (!force && cache?.dismissed === latest.version) return null;
  return latest;
}

export async function dismissApk(version: string) {
  const cache = (await readCache()) ?? { checkedAt: 0, latest: null };
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...cache, dismissed: version }));
}

/** Mise à jour EAS Update téléchargée et prête (APK uniquement). */
export async function fetchOta(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false;
  try {
    const r = await Updates.checkForUpdateAsync();
    if (!r.isAvailable) return false;
    const f = await Updates.fetchUpdateAsync();
    return f.isNew;
  } catch {
    return false;
  }
}

export const restartWithUpdate = () => Updates.reloadAsync().catch(() => {});

/** Date de la mise à jour du code en cours (null = celle de l'APK). */
export function otaDate(): Date | null {
  return !__DEV__ && Updates.isEnabled && !Updates.isEmbeddedLaunch ? Updates.createdAt ?? null : null;
}

/** Hook : ce qu'il faut proposer (relancer, ou télécharger un nouvel APK). */
export function useAppUpdates(enabled: boolean) {
  const [ota, setOta] = useState(false);
  const [apk, setApk] = useState<ApkRelease | null>(null);
  useEffect(() => {
    let alive = true;
    const run = () => {
      fetchOta().then((ok) => alive && ok && setOta(true));
      if (enabled) checkApk().then((x) => alive && setApk(x));
    };
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => {
      alive = false;
      sub.remove();
    };
  }, [enabled]);
  return {
    ota,
    apk,
    hideApk: () => {
      if (apk) dismissApk(apk.version);
      setApk(null);
    },
  };
}
