// Modèles des notifications : lus par le service worker (firebase-messaging-sw.js).
// Même liste que src/donnees/notifications.js (un test vérifie qu'elles sont identiques).
self.MODELES_NOTIFICATION = {
  annonce: { nom: 'Annonce', symbole: '📣', bouton: 'Ouvrir l’app', lien: '/#/' },
  rendezvous: { nom: 'Rendez-vous', symbole: '🔔', bouton: 'Voir la carte', lien: '/#/carte' },
  priere: { nom: 'Prière', symbole: '🙏', bouton: 'Prier', lien: '/#/prier' },
  chorale: { nom: 'Chorale', symbole: '🎶', bouton: 'Voir les chants', lien: '/#/prier' },
  merci: { nom: 'Merci', symbole: '💛', bouton: 'Voir les photos', lien: '/#/photos' },
  important: { nom: 'Important', symbole: '⚠️', bouton: 'Ouvrir l’app', lien: '/#/' },
};
