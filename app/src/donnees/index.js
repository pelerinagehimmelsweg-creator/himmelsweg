// Choisit la source de données : la vraie base Firebase si elle est configurée,
// sinon le mode démo (pèlerins fictifs, rien n'est envoyé nulle part).
import { creerDemo } from './demo.js';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_APP_ID?.split(':')[1],
};

const forcerDemo = new URLSearchParams(location.search).has('demo');

export async function chargerDonnees() {
  if (config.apiKey && config.projectId && !forcerDemo) {
    const { creerFirebase } = await import('./firebase.js');
    return creerFirebase(config, import.meta.env.VITE_SCRIPT_URL, import.meta.env.VITE_FIREBASE_VAPID_KEY);
  }
  return creerDemo();
}
