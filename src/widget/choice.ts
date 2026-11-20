import AsyncStorage from '@react-native-async-storage/async-storage';

// Note choisie pour chaque widget Notes posé (clé = identifiant Android du widget).
// Absent = automatique (épinglée d'abord, puis la plus récente).
const KEY = 'kairos:widget-notes:v1';

export async function loadNoteChoices(): Promise<Record<string, string>> {
  try {
    const s = await AsyncStorage.getItem(KEY);
    return s ? (JSON.parse(s) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function setNoteChoice(widgetId: number, noteId: string | null): Promise<void> {
  const all = await loadNoteChoices();
  if (noteId) all[String(widgetId)] = noteId;
  else delete all[String(widgetId)];
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}
