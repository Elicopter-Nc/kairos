/* eslint-disable @typescript-eslint/no-require-imports -- chargement paresseux volontaire : le module natif n'existe pas dans Expo Go */
import { Platform, TurboModuleRegistry } from 'react-native';

// Le module natif du widget n'existe que dans un build (APK / dev build).
// Dans Expo Go, il est absent : on ne charge alors JAMAIS la librairie
// (elle plante dès l'import si le module natif manque).
export const widgetAvailable: boolean = (() => {
  if (Platform.OS !== 'android') return false;
  try {
    return TurboModuleRegistry.get('AndroidWidget') != null;
  } catch {
    return false;
  }
})();

export const WIDGET_NAMES = ['KairosTasks', 'KairosAgenda', 'KairosMeteo', 'KairosNotes'];

export function registerWidgetIfAvailable() {
  if (!widgetAvailable) return;
  const { registerWidgetTaskHandler, registerWidgetConfigurationScreen } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./taskHandler');
  registerWidgetTaskHandler(widgetTaskHandler);
  // appui long sur le widget Notes → « Configurer » : choisir la note affichée
  const { NotesConfigScreen } = require('./NotesConfigScreen');
  registerWidgetConfigurationScreen(NotesConfigScreen);
}

/** Redessine tous les widgets Kairos posés sur l'écran d'accueil. */
export async function refreshWidget(): Promise<void> {
  if (!widgetAvailable) return;
  try {
    const { requestWidgetUpdate } = require('react-native-android-widget');
    const { loadDB } = require('../data/storage');
    const { renderFor } = require('./taskHandler');
    const db = await loadDB();
    for (const widgetName of WIDGET_NAMES) {
      await requestWidgetUpdate({ widgetName, renderWidget: (info: { width: number; height: number; widgetId: number }) => renderFor(widgetName, db, info), widgetNotFound: () => {} });
    }
  } catch (e) {
    console.warn('Widget', e);
  }
}
