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
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { REPAS_CONFIG_DEPART, texteAlerte } from './equipes.js';
import { droits, sansRolesDeChapitre } from './modele.js';
import { CONFIG_DEPART, QUESTIONS_DEPART } from './questionnaire.js';

export function creerFirebase(config, urlScript, cleVapid) {
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
        installerQuestionnaire().catch(() => {});
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

  // Première connexion d'un admin : on installe le questionnaire et les tarifs de départ.
  async function installerQuestionnaire() {
    if ((await getDoc(doc(db, 'config', 'inscription'))).exists()) {
      // Questions de base ajoutées après l'installation (ex. chorale) : on les crée si elles manquent.
      for (const { id, ...q } of QUESTIONS_DEPART.filter((x) => x.systeme)) {
        if (!(await getDoc(doc(db, 'questions', id))).exists()) await setDoc(doc(db, 'questions', id), q);
      }
      return;
    }
    const lot = writeBatch(db);
    lot.set(doc(db, 'config', 'inscription'), { ...CONFIG_DEPART, ouverte: false });
    QUESTIONS_DEPART.forEach(({ id, ...q }) => lot.set(doc(db, 'questions', id), q));
    await lot.commit();
  }

  // Appel au script Google (inscription, paiement HelloAsso, connexion par lien).
  async function script(action, donnees) {
    if (!urlScript) throw new Error('Les inscriptions en ligne ne sont pas encore branchées. Réessayez bientôt.');
    let rep;
    try {
      rep = await fetch(urlScript, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, ...donnees }),
      });
    } catch {
      throw new Error('Pas de connexion internet. Réessayez quand le réseau revient.');
    }
    const json = await rep.json();
    if (json.erreur) {
      const e = new Error(json.erreur);
      e.details = json.details;
      throw e;
    }
    return json;
  }

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
      const { jeton } = await script('connexion', { cle });
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
    async enregistrerChapitre({ id, ...c }) {
      if (id) {
        await setDoc(doc(db, 'chapitres', id), c);
        return id;
      }
      return (await addDoc(collection(db, 'chapitres'), c)).id;
    },
    // Les pèlerins du chapitre supprimé redeviennent « sans chapitre » (et perdent chef / adjoint sécurité).
    async supprimerChapitre(id) {
      const lot = writeBatch(db);
      (await getDocs(query(collection(db, 'membres'), where('chapitre', '==', id)))).forEach((d) =>
        lot.update(d.ref, { chapitre: null, roles: sansRolesDeChapitre(d.data().roles) }),
      );
      lot.delete(doc(db, 'chapitres', id));
      await lot.commit();
    },

    // Questionnaire d'inscription (lisible par tous, même sans connexion)
    ecouterQuestions: (cb) => liste(collection(db, 'questions'), cb),
    ecouterConfig: (cb) =>
      onSnapshot(
        doc(db, 'config', 'inscription'),
        (d) => cb(d.data() ?? false),
        () => cb(false),
      ),
    enregistrerQuestion: ({ id, ...q }) => setDoc(doc(db, 'questions', id), q),
    async enregistrerQuestions(questions) {
      const lot = writeBatch(db);
      questions.forEach(({ id, ...q }) => lot.set(doc(db, 'questions', id), q));
      await lot.commit();
    },
    supprimerQuestion: (id) => deleteDoc(doc(db, 'questions', id)),
    enregistrerConfig: (c) => setDoc(doc(db, 'config', 'inscription'), c),

    // Inscription publique : tout passe par le script Google, qui vérifie et calcule le prix.
    inscrire: (demande) => script('inscription', demande),
    etatInscription: (ref) => script('verifier', { ref }),
    payerInscription: (ref) => script('payer', { ref }),

    // Outils des équipes (les droits sont vérifiés par firebase/firestore.rules)
    ecouterConfigApp: (cb) =>
      onSnapshot(
        doc(db, 'config', 'app'),
        (d) => cb(d.data() ?? {}),
        () => cb({}),
      ),
    enregistrerConfigApp: (c) => setDoc(doc(db, 'config', 'app'), c),
    ecouterRepas: (cb) =>
      onSnapshot(
        doc(db, 'equipes', 'repas'),
        (d) => cb(d.data() ?? REPAS_CONFIG_DEPART),
        () => cb(null),
      ),
    enregistrerRepas: (c) => setDoc(doc(db, 'equipes', 'repas'), c),
    // Nombre par régime, calculé par le script Google toutes les 15 minutes (sans aucun nom).
    ecouterStatsRepas: (cb) =>
      onSnapshot(
        doc(db, 'stats', 'repas'),
        (d) => cb(d.data() ?? { total: 0, parRegime: {}, maj: null }),
        () => cb(null),
      ),
    ecouterListe: (nom, cb) => liste(collection(db, nom), cb),
    async enregistrerElement(nom, { id, ...el }) {
      if (id) {
        await setDoc(doc(db, nom, id), el);
        return id;
      }
      return (await addDoc(collection(db, nom), el)).id;
    },
    supprimerElement: (nom, id) => deleteDoc(doc(db, nom, id)),
    ecouterFil: (equipe, cb) => liste(collection(db, 'fils', equipe, 'messages'), (l) => cb(l.sort((a, b) => String(a.le).localeCompare(String(b.le))))),
    ecrireFil: (equipe, texte) =>
      addDoc(collection(db, 'fils', equipe, 'messages'), {
        auteur: auth.currentUser.uid,
        nom: `${session?.prenom ?? ''} ${session?.nom ?? ''}`.trim(),
        texte,
        le: new Date().toISOString(),
      }),
    async lancerAlerte({ message, position }) {
      const chapitre = session?.chapitre ? (await getDoc(doc(db, 'chapitres', session.chapitre))).data()?.nom ?? '' : '';
      const alerte = { auteur: auth.currentUser.uid, nom: `${session?.prenom ?? ''} ${session?.nom ?? ''}`.trim(), chapitre, message, position: position ?? null, le: new Date().toISOString(), traitee: false };
      const ref = await addDoc(collection(db, 'alertes'), alerte);
      let prevenus = null;
      try {
        prevenus = (await script('notifier', { idToken: await auth.currentUser.getIdToken(), cible: 'alerte', valeur: ref.id })).envoyes;
      } catch {}
      return { texte: texteAlerte(alerte), prevenus };
    },
    ecouterAlertes(cb) {
      const s = session;
      if (droits(s).admin || s?.roles?.includes('logistique')) return liste(collection(db, 'alertes'), cb);
      return liste(query(collection(db, 'alertes'), where('auteur', '==', s?.id ?? '-')), cb);
    },
    traiterAlerte: (id) => updateDoc(doc(db, 'alertes', id), { traitee: true }),
    // Le chef nomme (ou retire) l'adjoint sécurité de son chapitre.
    async nommerAdjoint(id, oui) {
      const m = (await getDoc(doc(db, 'membres', id))).data();
      const roles = new Set(m?.roles ?? []);
      oui ? roles.add('securite') : roles.delete('securite');
      await updateDoc(doc(db, 'membres', id), { roles: [...roles] });
    },
    notifications: cleVapid ? 'possible' : 'absent',
    async activerNotifications() {
      if (!cleVapid) throw new Error('Les notifications ne sont pas encore configurées.');
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        throw new Error('Ce téléphone ne permet pas les notifications. Sur iPhone, installez d’abord l’app sur l’écran d’accueil.');
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notifications refusées. Vous pouvez les autoriser dans les réglages du navigateur.');
      const { getMessaging, getToken } = await import('firebase/messaging');
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' });
      const token = await getToken(getMessaging(app), { vapidKey: cleVapid, serviceWorkerRegistration: registration });
      await setDoc(doc(db, 'jetons', auth.currentUser.uid), { token, maj: new Date().toISOString() });
      return 'Notifications activées sur ce téléphone.';
    },
    async envoyerNotification({ cible, valeur, titre, texte }) {
      return script('notifier', { idToken: await auth.currentUser.getIdToken(), cible, valeur, titre, texte });
    },
    // Désistement ou fiche de test : la fiche, ses infos protégées et son lien disparaissent.
    async supprimerMembre(id) {
      const cle = (await getDoc(doc(db, 'membres', id, 'admin', 'lien'))).data()?.cle;
      const lot = writeBatch(db);
      if (cle) lot.delete(doc(db, 'liens', cle));
      lot.delete(doc(db, 'membres', id, 'admin', 'lien'));
      lot.delete(doc(db, 'membres', id, 'prive', 'fiche'));
      lot.delete(doc(db, 'membres', id));
      await lot.commit();
    },
    async annulerDossier(ref) {
      const d = (await getDoc(doc(db, 'dossiers', ref))).data();
      for (const id of d?.membres ?? []) await this.supprimerMembre(id);
      await updateDoc(doc(db, 'dossiers', ref), { statut: 'annule', annuleLe: serverTimestamp() });
    },

    ecouterDossiers: (cb) => liste(collection(db, 'dossiers'), cb),
    // Chèque, espèces… : le script Google enverra les liens dans les 15 minutes.
    async validerDossier(ref, mode) {
      const lot = writeBatch(db);
      const d = (await getDoc(doc(db, 'dossiers', ref))).data();
      lot.update(doc(db, 'dossiers', ref), { statut: 'valide_main', mode, regleLe: serverTimestamp(), validePar: session?.email ?? '' });
      (d?.membres ?? []).forEach((id) => lot.update(doc(db, 'membres', id), { statut: 'inscrit' }));
      await lot.commit();
    },

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
        statut: 'inscrit',
        ...champs,
        inscritLe: new Date().toISOString().slice(0, 10),
      });
      await setDoc(doc(db, 'membres', ref.id, 'prive', 'fiche'), prive ?? {});
      return ref.id;
    },
    modifierMembre: (id, champs) => updateDoc(doc(db, 'membres', id), champs),
    // Le pèlerin corrige ses réponses (la base n'autorise que ces champs-là).
    async modifierMesReponses(id, champs, prive) {
      await updateDoc(doc(db, 'membres', id), champs);
      await setDoc(doc(db, 'membres', id, 'prive', 'fiche'), prive);
    },
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
