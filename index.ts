import 'expo-router/entry';
// définit la tâche de fond (doit être chargé au démarrage, avant tout rendu)
import './src/lib/background';
import { registerWidgetIfAvailable } from './src/widget/bridge';

// Le widget n'existe que dans un build natif (APK) : dans Expo Go, cet appel ne fait rien.
registerWidgetIfAvailable();
