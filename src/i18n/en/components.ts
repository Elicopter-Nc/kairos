export const components: Record<string, string> = {
  // ui
  'Fermer': 'Close',
  'Kaki': 'Kaki',
  'Yuzu': 'Yuzu',
  'Matcha': 'Matcha',
  'Sauge': 'Sage',
  'Ciel': 'Sky',
  'Glycine': 'Wisteria',
  'Sakura': 'Sakura',
  'Sumi': 'Sumi',

  // editor
  'Enregistrer': 'Save',
  'Fermer sans enregistrer': 'Close without saving',
  'Lier à un événement': 'Link to an event',
  'Rechercher…': 'Search…',
  'Aucun événement entre il y a 30 jours et dans 90 jours.': 'No events from 30 days ago to 90 days ahead.',
  'Changer d’événement': 'Change event',
  'Délier': 'Unlink',

  // items / TaskItem
  '{n} note': '{n} note',
  '{n} notes': '{n} notes',
  '{n} photo': '{n} photo',
  '{n} photos': '{n} photos',
  'Supprimer la tâche ?': 'Delete this task?',
  'Annuler': 'Cancel',
  'Supprimer': 'Delete',
  'Urgente': 'Urgent',
  'Priorité haute': 'High priority',
  'Rouvrir': 'Reopen',
  'Fait': 'Done',
  'Demain': 'Tomorrow',
  '{n} j': '{n} d',
  '{n} sem.': '{n} wk',
  '{n} mois': '{n} mo',
  '{n} an': '{n} yr',
  'chaque jour': 'daily',
  'chaque sem.': 'weekly',
  'chaque mois': 'monthly',
  'chaque année': 'yearly',

  // WeekView
  'Férié : {name}': 'Holiday: {name}',
  '{title}, toute la journée': '{title}, all day',
  '{h}h': '{h}:00',
  'Créer un événement le {date}': 'Create an event on {date}',
  '{title}, {start} à {end}': '{title}, {start} to {end}',

  // WeatherCard
  'Lecture du ciel…': 'Reading the sky…',
  'Météo indisponible pour le moment.': 'Weather unavailable for now.',
  'Météo : {desc}, {temp} degrés': 'Weather: {desc}, {temp} degrees',
  'Hors-ligne · mis à jour {age}': 'Offline · updated {age}',
  'mis à jour {age}': 'updated {age}',

  // JournalCard / JournalBook
  'Ta journée': 'Your day',
  'Le mois': 'The month',
  'Une ligne pour aujourd’hui…': 'One line for today…',
  'Belle journée': 'Good day',
  'Mitigée': 'Mixed',
  'Difficile': 'Hard',
  'Page précédente': 'Previous page',
  'Page suivante': 'Next page',
  'Page {n} sur {total} · glisse pour tourner': 'Page {n} of {total} · swipe to turn',
  'Journal, page {n} sur {total}. Glisse pour tourner les pages.': 'Journal, page {n} of {total}. Swipe to turn the pages.',

  // BonsaiTree
  'Bonsaï : {active} jours actifs, {pads} nuages de feuillage. Touche une branche pour voir son jour.':
    'Bonsai: {active} active days, {pads} foliage clouds. Touch a branch to see its day.',

  // TagEditor
  'Retirer le tag {tag}': 'Remove tag {tag}',
  'autre tag': 'another tag',
  'nouveau tag': 'new tag',
  'Ajouter un tag': 'Add a tag',
  'Ajouter le tag {tag}': 'Add tag {tag}',
  'Tag {name}, {n} élément. Appui long pour le supprimer': 'Tag {name}, {n} item. Long press to delete it',
  'Tag {name}, {n} éléments. Appui long pour le supprimer': 'Tag {name}, {n} items. Long press to delete it',

  // UndoToast (libellés venant du store)
  'Annuler la suppression': 'Undo delete',
  'Note supprimée': 'Note deleted',
  'Tâche supprimée': 'Task deleted',
  'Événement supprimé': 'Event deleted',

  // UpdateBanner
  'Mise à jour prête': 'Update ready',
  'Kairos {version} est sorti': 'Kairos {version} is out',
  'Relance l’app pour en profiter.': 'Restart the app to use it.',
  'Nouvel APK à installer par-dessus : tes données sont gardées.': 'New APK to install over this one: your data is kept.',
  'Relancer': 'Restart',
  'Télécharger': 'Download',
  'Ignorer cette version': 'Skip this version',

  // PlacePicker / MapPreview / LinkPreview / PhotoViewer
  'Pas de suggestions (hors-ligne ?)': 'No suggestions (offline?)',
  'Lieu': 'Place',
  'Adresse, lieu, ville…': 'Address, place, city…',
  'Lieu trouvé sur la carte': 'Place found on the map',
  'Recherche © OpenStreetMap': 'Search © OpenStreetMap',
  'Carte : {label}. Ouvrir dans l’application de cartes': 'Map: {label}. Open in the maps app',
  '~{n} min en voiture depuis ta position': '~{n} min by car from where you are',
  '~{n} min à vélo depuis ta position': '~{n} min by bike from where you are',
  '~{n} min à pied depuis ta position': '~{n} min on foot from where you are',
  'Ouvrir {domain}': 'Open {domain}',
  '{title}, ouvrir le lien': '{title}, open the link',
  'Lecture de la page…': 'Reading the page…',
  'Fermer la photo': 'Close photo',

  // HolidayBadge / HolidaySettings
  'Jour férié : {name}': 'Public holiday: {name}',
  '{name} · jusqu’au {date}': '{name} · until {date}',
  '{name} · dernier jour': '{name} · last day',
  'Prochain férié : {name} demain': 'Next holiday: {name} tomorrow',
  'Prochain férié : {name} dans {n} j': 'Next holiday: {name} in {n} d',
  'Jours fériés': 'Public holidays',
  'Vacances scolaires': 'School holidays',
  'Mise à jour…': 'Updating…',
  'Mis à jour {age}': 'Updated {age}',
  'Pas encore téléchargé': 'Not downloaded yet',
  'Données publiques (api.gouv.fr, data.education.gouv.fr), mises à jour une fois par semaine. Seule la zone choisie est demandée, rien de personnel n’est envoyé. Hors-ligne, la dernière version reste affichée.':
    'Public data (api.gouv.fr, data.education.gouv.fr), updated once a week. Only the chosen zone is requested, nothing personal is sent. Offline, the last version stays on screen.',
  'Masquer les jours fériés': 'Hide public holidays',
  'Masquer les vacances': 'Hide school holidays',
  'Métropole': 'Mainland France',

  // DeviceCalendarSettings / DeviceEventItem
  'Calendriers du téléphone': 'Phone calendars',
  '{n} affiché dans l’Agenda': '{n} shown in the Agenda',
  '{n} affichés dans l’Agenda': '{n} shown in the Agenda',
  'Choisis ceux à afficher dans l’Agenda': 'Choose which ones to show in the Agenda',
  'Lecture seule, rien ne quitte le téléphone': 'Read-only, nothing leaves the phone',
  'Aucun calendrier trouvé sur ce téléphone.': 'No calendars found on this phone.',
  'L’accès aux calendriers a été refusé. Tu peux l’autoriser dans les réglages Android.':
    'Calendar access was denied. You can allow it in the Android settings.',
  'Autoriser l’accès': 'Allow access',
  'Réglages Android': 'Android settings',
  '{title}, calendrier du téléphone {cal}': '{title}, phone calendar {cal}',
};
