// Partage de la position des chefs de chapitre avec la logistique, pendant le pèlerinage seulement.
// Fonctionne tant que l'app est ouverte (sur n'importe quel onglet).
import { useEffect } from 'preact/hooks';
import { useAbonnement } from '../composants/base.jsx';
import { distanceKm } from './carte.js';
import { momentDu } from './modele.js';

const CLE = 'himmelsweg-partage-position';
let actif = (() => {
  try {
    return localStorage.getItem(CLE) === '1';
  } catch {
    return false;
  }
})();
const abonnes = new Set();

export const ecouterPartage = (cb) => {
  abonnes.add(cb);
  cb(actif);
  return () => abonnes.delete(cb);
};

/** Le chef peut-il partager sa position maintenant ? (en démo : toujours, pour essayer) */
export const peutPartager = (donnees, session) =>
  !!session?.roles?.includes('chef') && !!navigator.geolocation && (momentDu() === 'pendant' || donnees.mode === 'demo');

export async function changerPartage(donnees, session, v) {
  actif = v;
  try {
    localStorage.setItem(CLE, v ? '1' : '');
  } catch {
    // sans stockage : le partage s'arrête à la fermeture de l'app
  }
  abonnes.forEach((f) => f(v));
  if (!v) await donnees.supprimerElement('positions', session.id).catch(() => {});
}

export function usePartagePosition(donnees, session) {
  const on = useAbonnement(ecouterPartage, [], false);
  const autorise = peutPartager(donnees, session);
  useEffect(() => {
    if (!on || !autorise) return;
    let dernier = null;
    const envoyer = (p) => {
      const { latitude: lat, longitude: lng, accuracy } = p.coords;
      const t = Date.now();
      // Pas plus d'un envoi par minute, sauf si le chef a bougé de plus de 50 m.
      if (dernier && t - dernier.t < 60000 && distanceKm([[dernier.lat, dernier.lng], [lat, lng]]) < 0.05) return;
      dernier = { t, lat, lng };
      donnees
        .enregistrerElement('positions', {
          id: session.id,
          lat,
          lng,
          precision: Math.round(accuracy),
          maj: new Date(t).toISOString(),
          nom: `${session.prenom ?? ''} ${session.nom ?? ''}`.trim(),
          chapitre: session.chapitre ?? null,
        })
        .catch(() => {});
    };
    const erreur = (e) => {
      if (e.code === 1) changerPartage(donnees, session, false);
    };
    const opts = { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 };
    const id = navigator.geolocation.watchPosition(envoyer, erreur, opts);
    // Le téléphone ne signale rien quand on ne bouge pas : on redonne signe de vie toutes les 3 minutes.
    const minuteur = setInterval(() => {
      dernier = dernier && { ...dernier, t: 0 };
      navigator.geolocation.getCurrentPosition(envoyer, erreur, opts);
    }, 180000);
    return () => {
      navigator.geolocation.clearWatch(id);
      clearInterval(minuteur);
    };
  }, [on, autorise, session?.id]);
  return on && autorise;
}
