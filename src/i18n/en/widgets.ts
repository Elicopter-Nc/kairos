export const widgets: Record<string, string> = {
  // widgets : communs
  'Nouvelle tâche': 'New task',
  'Nouvelle note': 'New note',
  'Nouvel événement': 'New event',
  'Sans titre': 'Untitled',
  'Aujourd’hui': 'Today',
  'aujourd’hui': 'today',

  // widget tâches
  'Tâches': 'Tasks',
  'Cocher {title}': 'Check {title}',
  'Décocher {title}': 'Uncheck {title}',
  '{done} SUR {total} FAITES': '{done} OF {total} DONE',
  '{n} À FAIRE': '{n} TO DO',
  '{n} à faire': '{n} to do',
  'Journée': 'All day',
  'Table rase.': 'All clear.',
  'Tout est fait.': 'All done.',
  'Touche + pour ajouter une tâche': 'Tap + to add a task',
  'Touchez + pour ajouter une tâche': 'Tap + to add a task',
  '+ {n} autre': '+ {n} more',
  '+ {n} autres': '+ {n} more',

  // widget agenda
  'Cette semaine': 'This week',
  'Semaine': 'Week',
  'aucun RENDEZ-VOUS': 'NO EVENTS',
  '1 RENDEZ-VOUS': '1 EVENT',
  '{n} RENDEZ-VOUS': '{n} EVENTS',
  'Agenda libre.': 'Nothing planned.',
  'Rien de prévu cette semaine': 'Nothing planned this week',
  'Agenda libre cette semaine': 'Nothing planned this week',

  // widget notes
  'Notes': 'Notes',
  '{n} note': '{n} note',
  '{n} notes': '{n} notes',
  'épinglée': 'pinned',
  'Page blanche.': 'Blank page.',
  'Touche + pour écrire': 'Tap + to write',
  'Touchez + pour écrire': 'Tap + to write',

  // écran de configuration du widget notes
  'WIDGET NOTES': 'NOTES WIDGET',
  'Quelle note afficher ?': 'Which note to show?',
  'Automatique': 'Automatic',
  'La note épinglée, sinon la plus récente': 'The pinned note, or else the most recent',
  'Aucune note pour l’instant.': 'No notes yet.',
  'Annuler': 'Cancel',

  // widget météo
  'Active la météo dans Kairos': 'Turn on weather in Kairos',
  'maintenant': 'now',
  'mtn': 'now',
  '{h}h': '{h}:00',
  'Ici': 'Here',
  'pluie {p} %': 'rain {p}%',
  'pluie ce soir {p} %': 'rain tonight {p}%',
  // descriptions du ciel (src/lib/weather.ts describe().fr), traduites à l'affichage
  'Grand soleil': 'Sunny',
  'Nuit claire': 'Clear night',
  'Plutôt ensoleillé': 'Mostly sunny',
  'Nuit dégagée': 'Mostly clear night',
  'Éclaircies': 'Partly cloudy',
  'Couvert': 'Overcast',
  'Brouillard': 'Fog',
  'Bruine': 'Drizzle',
  'Forte pluie': 'Heavy rain',
  'Averses': 'Showers',
  'Pluie': 'Rain',
  'Neige': 'Snow',
  'Orage': 'Thunderstorm',
  'Variable': 'Changeable',

  // data/tasks.ts : répétition
  'Tous les jours': 'Every day',
  'Toutes les semaines': 'Every week',
  'Tous les mois': 'Every month',
  'Tous les ans': 'Every year',
  'Tous les {n} jours': 'Every {n} days',
  'Toutes les {n} semaines': 'Every {n} weeks',
  'Tous les {n} mois': 'Every {n} months',
  'Tous les {n} ans': 'Every {n} years',

  // data/store.tsx : annulation
  'Événement supprimé': 'Event deleted',
  'Tâche supprimée': 'Task deleted',
  'Note supprimée': 'Note deleted',

  // data/types.ts : libellés de constantes (tr(x.label) à l'affichage, côté écrans)
  'Aucun': 'None',
  "À l'heure": 'On time',
  '5 min': '5 min',
  '15 min': '15 min',
  '30 min': '30 min',
  '1 h': '1 h',
  '1 jour': '1 day',
  'Une fois': 'Once',
  'Chaque jour': 'Daily',
  'Chaque semaine': 'Weekly',
  'Chaque mois': 'Monthly',
  'Chaque année': 'Yearly',
};
