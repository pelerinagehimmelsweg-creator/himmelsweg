// Reçoit les notifications de l'app, même quand elle est fermée (Firebase Cloud Messaging),
// et les affiche selon leur modèle : grande photo encadrée d'or (Android, ordinateur), petite croix
// dans la barre d'état, bouton vers la bonne page, vibration en trois coups de cloche.
// Sur iPhone, Apple n'affiche que l'icône, le titre et le texte.
// Le titre est écrit en lettres dorées sur la photo, dessinée ici même (notifications/affiche.js).
// Quand l'app est ouverte et visible, elle affiche elle-même une bannière à la place.
importScripts('/notifications/modeles.js', '/notifications/affiche.js');

const MODELES = self.MODELES_NOTIFICATION;
const CLOCHE = [260, 140, 260, 140, 420];
const surIphone = /iPhone|iPad|Macintosh/.test(self.navigator.userAgent) && !/Chrome|Android/.test(self.navigator.userAgent);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

/** Message reçu → ce qu'on affiche. Accepte aussi l'ancien format (titre et texte dans « notification »). */
function lire(event) {
  let brut = {};
  try {
    brut = event.data ? event.data.json() : {};
  } catch {
    brut = { data: { texte: event.data && event.data.text() } };
  }
  const d = brut.data || {};
  const n = brut.notification || {};
  const modele = MODELES[d.modele] ? d.modele : 'annonce';
  const m = MODELES[modele];
  return {
    id: d.id || brut.fcmMessageId || String(Date.now()),
    modele,
    symbole: m.symbole,
    titre: d.titre || n.title || 'Himmelsweg',
    texte: d.texte || n.body || '',
    lien: d.lien || m.lien,
    bouton: d.bouton || m.bouton,
    image: `/notifications/${modele}.jpg`,
  };
}

/** L'affiche (photo + titre doré) en adresse data:, ou la photo simple si le dessin échoue ou traîne. */
async function affiche(n) {
  try {
    const dessin = self.AFFICHE_NOTIFICATION.dessinerAffiche(n.modele, n.titre).then(
      (blob) =>
        new Promise((ok, ko) => {
          const r = new FileReader();
          r.onload = () => ok(r.result);
          r.onerror = ko;
          r.readAsDataURL(blob);
        }),
    );
    const trop = new Promise((ok) => setTimeout(() => ok(n.image), 4000));
    return await Promise.race([dessin, trop]);
  } catch {
    return n.image;
  }
}

self.addEventListener('push', (event) => {
  const n = lire(event);
  event.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const visible = fenetres.find((c) => c.visibilityState === 'visible' && c.focused);
      fenetres.forEach((c) => c.postMessage({ type: 'notification', notification: n }));
      // App ouverte devant les yeux : la bannière suffit (sauf sur iPhone, qui exige une notification).
      if (visible && !surIphone) return;
      await self.registration.showNotification(`${n.symbole} ${n.titre}`, {
        body: n.texte,
        icon: '/icone-192.png',
        badge: '/notifications/badge.png',
        image: surIphone ? undefined : await affiche(n),
        tag: n.id,
        vibrate: CLOCHE,
        data: { lien: n.lien },
        actions: n.lien === '/#/' ? [] : [{ action: 'bouton', title: n.bouton }, { action: 'ouvrir', title: 'Ouvrir' }],
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const lien = event.action === 'ouvrir' ? '/#/' : (event.notification.data && event.notification.data.lien) || '/#/';
  event.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const f = fenetres[0];
      if (f) {
        f.postMessage({ type: 'aller', lien });
        return f.focus();
      }
      return self.clients.openWindow(lien);
    })(),
  );
});
