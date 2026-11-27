// Modèles des notifications (même liste que public/notifications/modeles.js, lue par le service worker).
export const MODELES_NOTIFICATION = {
  annonce: { nom: 'Annonce', symbole: '📣', bouton: 'Ouvrir l’app', lien: '/#/' },
  rendezvous: { nom: 'Rendez-vous', symbole: '🔔', bouton: 'Voir la carte', lien: '/#/carte' },
  priere: { nom: 'Prière', symbole: '🙏', bouton: 'Prier', lien: '/#/prier' },
  chorale: { nom: 'Chorale', symbole: '🎶', bouton: 'Voir les chants', lien: '/#/prier' },
  merci: { nom: 'Merci', symbole: '💛', bouton: 'Voir les photos', lien: '/#/photos' },
  important: { nom: 'Important', symbole: '⚠️', bouton: 'Ouvrir l’app', lien: '/#/' },
};

/** Ce qu'affichent le téléphone et la bannière de l'app. */
export function notificationAffichee({ modele, titre, texte, lien, bouton }) {
  const id = MODELES_NOTIFICATION[modele] ? modele : 'annonce';
  const m = MODELES_NOTIFICATION[id];
  return { modele: id, symbole: m.symbole, nom: m.nom, titre: titre || 'Himmelsweg', texte: texte || '', lien: lien || m.lien, bouton: bouton || m.bouton, image: `/notifications/${id}.jpg` };
}

/** Date et heure lisibles (heure de Paris). */
export const quandNotification = (iso) =>
  new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
