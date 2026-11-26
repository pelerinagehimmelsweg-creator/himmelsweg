// MODE DÉMO : tout est gardé dans le navigateur (localStorage), avec des pèlerins fictifs.
// Il applique les mêmes droits que la vraie base, pour que la démo montre ce que voit chaque rôle.

import { CHAPITRES, CONTENUS, PERSONAS, membresExemple } from './exemples.js';
import { droits } from './modele.js';

const CLE = 'himmelsweg-demo-v1';
const CLE_SESSION = 'himmelsweg-demo-session';

function lireEtat() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return JSON.parse(brut);
  } catch {}
  const membres = membresExemple();
  const prive = Object.fromEntries(membres.map((m) => [m.id, m.prive]));
  membres.forEach((m) => delete m.prive);
  const liens = Object.fromEntries(membres.map((m) => [`demo-${m.id}`, m.id]));
  return { membres, prive, liens, contenus: CONTENUS, chapitres: CHAPITRES };
}

export function creerDemo() {
  let etat = lireEtat();
  const abonnes = new Set();
  const sauver = () => {
    try {
      localStorage.setItem(CLE, JSON.stringify(etat));
    } catch {}
    abonnes.forEach((f) => f());
  };
  const ecouter = (calcul, cb) => {
    const f = () => cb(calcul());
    abonnes.add(f);
    f();
    return () => abonnes.delete(f);
  };

  let sessionId = null;
  try {
    sessionId = localStorage.getItem(CLE_SESSION);
  } catch {}

  const session = () => {
    if (!sessionId) return null;
    if (sessionId === 'admin-directrice') {
      return { id: sessionId, prenom: 'La directrice', nom: '', estAdmin: true, roles: [] };
    }
    const m = etat.membres.find((x) => x.id === sessionId);
    return m ? { ...m, estAdmin: false } : null;
  };

  const choisirSession = (id) => {
    sessionId = id;
    try {
      if (id) localStorage.setItem(CLE_SESSION, id);
      else localStorage.removeItem(CLE_SESSION);
    } catch {}
    abonnes.forEach((f) => f());
  };

  // Mêmes règles que firebase/firestore.rules
  const peutVoirMembre = (s, m) => {
    if (!s) return false;
    const d = droits(s);
    if (d.voirTousLesMembres || s.id === m.id) return true;
    const r = s.roles ?? [];
    return (r.includes('chef') || r.includes('securite')) && !!s.chapitre && m.chapitre === s.chapitre;
  };
  const peutVoirPrive = (s, m) => {
    if (!s) return false;
    const d = droits(s);
    if (d.voirSanteDeTous || s.id === m.id) return true;
    return d.voirSanteDeSonChapitre && !!s.chapitre && m.chapitre === s.chapitre;
  };
  const exigerAdmin = () => {
    if (!session()?.estAdmin) throw new Error('Réservé aux administrateurs');
  };

  return {
    mode: 'demo',
    personas: PERSONAS,

    surSession: (cb) => ecouter(session, cb),
    connexionDemo: (id) => choisirSession(id),
    async connexionLien(cle) {
      const id = etat.liens[cle];
      if (!id) throw new Error('Ce lien n’est plus valable. Demandez-en un nouveau au secrétariat.');
      choisirSession(id);
    },
    async connexionGoogle() {
      choisirSession('admin-directrice');
    },
    async deconnexion() {
      choisirSession(null);
    },
    reinitialiser() {
      try {
        localStorage.removeItem(CLE);
      } catch {}
      etat = lireEtat();
      sauver();
    },

    ecouterContenus: (cb) =>
      ecouter(() => (session() ? [...etat.contenus].sort((a, b) => a.ordre - b.ordre) : []), cb),
    async enregistrerContenu(c) {
      exigerAdmin();
      const id = c.id || `c-${Date.now()}`;
      etat.contenus = [...etat.contenus.filter((x) => x.id !== id), { ...c, id }];
      sauver();
      return id;
    },
    async supprimerContenu(id) {
      exigerAdmin();
      etat.contenus = etat.contenus.filter((x) => x.id !== id);
      sauver();
    },

    ecouterChapitres: (cb) => ecouter(() => (session() ? etat.chapitres : []), cb),

    ecouterMembres: (cb) =>
      ecouter(() => {
        const s = session();
        return etat.membres.filter((m) => peutVoirMembre(s, m));
      }, cb),
    ecouterPrive: (id, cb) =>
      ecouter(() => {
        const s = session();
        const m = etat.membres.find((x) => x.id === id);
        if (!m || !peutVoirPrive(s, m)) return { refuse: true };
        return etat.prive[id] ?? {};
      }, cb),

    async ajouterMembre(champs, prive) {
      exigerAdmin();
      const id = `m-${Date.now()}`;
      etat.membres = [...etat.membres, { roles: ['pelerin'], ...champs, id, inscritLe: new Date().toISOString().slice(0, 10) }];
      etat.prive = { ...etat.prive, [id]: prive ?? {} };
      sauver();
      return id;
    },
    async modifierMembre(id, champs) {
      exigerAdmin();
      etat.membres = etat.membres.map((m) => (m.id === id ? { ...m, ...champs } : m));
      sauver();
    },
    async modifierPrive(id, champs) {
      exigerAdmin();
      etat.prive = { ...etat.prive, [id]: { ...etat.prive[id], ...champs } };
      sauver();
    },
    async lienPersonnel(id, { nouveau = false } = {}) {
      exigerAdmin();
      let cle = Object.keys(etat.liens).find((k) => etat.liens[k] === id);
      if (!cle || nouveau) {
        if (cle) delete etat.liens[cle];
        cle = `demo-${id}-${Math.random().toString(36).slice(2, 8)}`;
        etat.liens = { ...etat.liens, [cle]: id };
        sauver();
      }
      return `${location.origin}/#cle=${cle}`;
    },
  };
}
