// Dictionnaire anglais : clé = texte français exact, valeur = traduction.
// Un fichier par partie de l'app, fusionnés ici.
import { components } from './components';
import { lib } from './lib';
import { screens } from './screens';
import { tabs } from './tabs';
import { widgets } from './widgets';

export const EN: Record<string, string> = { ...lib, ...widgets, ...components, ...screens, ...tabs };
