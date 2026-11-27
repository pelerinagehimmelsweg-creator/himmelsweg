// Bannière affichée en haut de l'app quand une notification arrive alors que l'app est ouverte.
// Le service worker (public/firebase-messaging-sw.js) envoie aussi « aller » quand on touche une notification.
import { useEffect, useState } from 'preact/hooks';
import { notificationAffichee } from '../donnees/notifications.js';

export const montrerBanniere = (n) => dispatchEvent(new CustomEvent('himmelsweg-notification', { detail: n }));

export function BanniereNotification() {
  const [n, setN] = useState(null);
  useEffect(() => {
    const recevoir = (msg) => {
      if (msg?.type === 'notification') setN(notificationAffichee(msg.notification));
      if (msg?.type === 'aller' && msg.lien) location.hash = msg.lien.split('#')[1] ?? '/';
    };
    const sw = (e) => recevoir(e.data);
    const local = (e) => recevoir({ type: 'notification', notification: e.detail });
    navigator.serviceWorker?.addEventListener('message', sw);
    navigator.serviceWorker?.startMessages?.();
    addEventListener('himmelsweg-notification', local);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', sw);
      removeEventListener('himmelsweg-notification', local);
    };
  }, []);
  useEffect(() => {
    if (!n) return;
    navigator.vibrate?.([260, 140, 260, 140, 420]);
    const t = setTimeout(() => setN(null), 15000);
    return () => clearTimeout(t);
  }, [n]);
  if (!n) return null;
  return <Banniere n={n} fermer={() => setN(null)} />;
}

/** La bannière elle-même (sert aussi à l'aperçu des admins). */
export function Banniere({ n, fermer, apercu = false }) {
  const aller = () => {
    location.hash = n.lien.split('#')[1] ?? '/';
    fermer?.();
  };
  return (
    <div class={`banniere-notif modele-${n.modele}${apercu ? ' apercu' : ''}`} role={apercu ? undefined : 'alert'}>
      <div class="bn-photo" style={{ backgroundImage: `url(${n.image})` }} />
      {fermer && (
        <button type="button" class="bn-fermer" aria-label="Fermer" onClick={fermer}>
          ×
        </button>
      )}
      <div class="bn-corps">
        <span class="bn-eti">
          {n.symbole} {n.nom}
        </span>
        <strong class="bn-titre">{n.titre}</strong>
        {n.texte && <p>{n.texte}</p>}
        {n.lien !== '/#/' && (
          <button type="button" class="bouton petit" onClick={apercu ? undefined : aller}>
            {n.bouton}
          </button>
        )}
      </div>
    </div>
  );
}
