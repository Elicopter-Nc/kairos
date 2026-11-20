import { isRunningInExpoGo } from 'expo';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { loadDB } from '../data/storage';
import type { Settings } from '../data/types';
import { resolveLang, setLang } from '../i18n';
import { refreshWidget } from '../widget/bridge';
import { rescheduleAll } from './notifications';
import { refreshWeather } from './weather';

// Tâche de fond (APK uniquement, indisponible dans Expo Go) : environ une fois par
// heure, Android réveille l'app quelques secondes pour rafraîchir la météo à la
// dernière position connue (aucun accès GPS en arrière-plan), puis reprogramme les
// alertes pluie et met à jour les widgets. Android décide du moment exact.

const TASK = 'kairos-refresh';

try {
  TaskManager.defineTask(TASK, async () => {
  try {
    const db = await loadDB();
    setLang(resolveLang(db.settings.language)); // pas d'interface ici : langue lue dans la base
    if (db.settings.weather) await refreshWeather(true, true);
    await rescheduleAll(db);
    await refreshWidget();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
  });
} catch {
  // module natif absent (ex. Expo Go) : pas de tâche de fond, sans conséquence
}

/** Active ou coupe la tâche selon les réglages (appelé au démarrage et quand ils changent). */
export async function syncBackgroundTask(settings: Settings): Promise<void> {
  if (isRunningInExpoGo()) return;
  try {
    const wanted = settings.weather; // alertes pluie + widget météo
    const registered = await TaskManager.isTaskRegisteredAsync(TASK);
    if (wanted && !registered) await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 60 });
    if (!wanted && registered) await BackgroundTask.unregisterTaskAsync(TASK);
  } catch (e) {
    console.warn('Tâche de fond', e);
  }
}
