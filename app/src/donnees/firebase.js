// VRAIE BASE : Firebase (Google), rattachée au compte pelerinagehimmelsweg@gmail.com.
// Les droits sont vérifiés par le serveur (firebase/firestore.rules), pas seulement ici.

import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { droits } from './modele.js';

export function creerFirebase(config, urlScript) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  // Copie de la base sur le téléphone : l'app fonctionne hors ligne.
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });

  let session; // undefined = on attend la réponse de Firebase
  const abonnes = new Set();
  const publier = (s) => {
    session = s;
    abonnes.forEach((f) => f(s));
  };
  let stopMembre = null;

  onAuthStateChanged(auth, async (user) => {
    stopMembre?.();
    stopMembre = null;
    if (!user) return publier(null);
    // Administrateur : connexion Google, adresse inscrite dans la collection « admins ».
    if (user.email) {
      let estAdmin = false;
      try {
        estAdmin = (await getDoc(doc(db, 'admins', user.email.toLowerCase()))).exists();
      } catch {}
      if (estAdmin) {
        return publier({ id: user.uid, prenom: user.displayName || user.email, nom: '', email: user.email, estAdmin: true, roles: [] });
      }
      await signOut(auth);
      return publier({ refuse: `L’adresse ${user.email} n’est pas administratrice de l’app.` });
    }
    // Participant : connecté par son lien personnel, son identifiant est celui de sa fiche.
    stopMembre = onSnapshot(
      doc(db, 'membres', user.uid),
      (d) => publier(d.exists() ? { ...d.data(), id: d.id, estAdmin: false } : { refuse: 'Fiche introuvable.' }),
      () => publier({ refuse: 'Fiche inaccessible.' }),
    );
  });

  const liste = (q, cb) =>
    onSnapshot(
      q,
      (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      () => cb([]),
    );

  return {
    mode: 'firebase',
    personas: [],

    surSession(cb) {
      abonnes.add(cb);
      if (session !== undefined) cb(session);
      return () => abonnes.delete(cb);
    },
    async connexionGoogle() {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    async connexionLien(cle) {
      if (!urlScript) throw new Error('Connexion par lien pas encore configurée.');
      const rep = await fetch(urlScript, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'connexion', cle }),
      });
      const { jeton, erreur } = await rep.json();
      if (!jeton) throw new Error(erreur || 'Ce lien n’est plus valable. Demandez-en un nouveau au secrétariat.');
      await signInWithCustomToken(auth, jeton);
    },
    async deconnexion() {
      await signOut(auth);
    },

    ecouterContenus: (cb) =>
      liste(collection(db, 'contenus'), (l) => cb(l.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)))),
    async enregistrerContenu({ id, ...c }) {
      if (id) {
        await setDoc(doc(db, 'contenus', id), c);
        return id;
      }
      return (await addDoc(collection(db, 'contenus'), c)).id;
    },
    supprimerContenu: (id) => deleteDoc(doc(db, 'contenus', id)),

    ecouterChapitres: (cb) => liste(collection(db, 'chapitres'), cb),

    ecouterMembres(cb) {
      const s = session;
      if (!s || s.refuse) return cb([]), () => {};
      const r = s.roles ?? [];
      if (droits(s).voirTousLesMembres) return liste(collection(db, 'membres'), cb);
      if ((r.includes('chef') || r.includes('securite')) && s.chapitre) {
        return liste(query(collection(db, 'membres'), where('chapitre', '==', s.chapitre)), cb);
      }
      return liste(query(collection(db, 'membres'), where(documentId(), '==', s.id)), cb);
    },
    ecouterPrive: (id, cb) =>
      onSnapshot(
        doc(db, 'membres', id, 'prive', 'fiche'),
        (d) => cb(d.data() ?? {}),
        () => cb({ refuse: true }),
      ),

    async ajouterMembre(champs, prive) {
      const ref = await addDoc(collection(db, 'membres'), {
        roles: ['pelerin'],
        ...champs,
        inscritLe: new Date().toISOString().slice(0, 10),
      });
      await setDoc(doc(db, 'membres', ref.id, 'prive', 'fiche'), prive ?? {});
      return ref.id;
    },
    modifierMembre: (id, champs) => updateDoc(doc(db, 'membres', id), champs),
    modifierPrive: (id, champs) => setDoc(doc(db, 'membres', id, 'prive', 'fiche'), champs, { merge: true }),

    // Lien personnel : une clé secrète, rangée dans « liens » (illisible par les téléphones).
    // Le script Google vérifie la clé et ouvre la session du pèlerin.
    async lienPersonnel(id, { nouveau = false } = {}) {
      const refAdmin = doc(db, 'membres', id, 'admin', 'lien');
      const actuel = (await getDoc(refAdmin)).data()?.cle;
      let cle = actuel;
      if (!cle || nouveau) {
        const octets = crypto.getRandomValues(new Uint8Array(18));
        cle = btoa(String.fromCharCode(...octets)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]);
        await setDoc(doc(db, 'liens', cle), { membreId: id, cree: serverTimestamp() });
        await setDoc(refAdmin, { cle });
        if (actuel) await deleteDoc(doc(db, 'liens', actuel));
      }
      return `${location.origin}/#cle=${cle}`;
    },
  };
}
