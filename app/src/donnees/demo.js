// MODE DÉMO : tout est gardé dans le navigateur (localStorage), avec des pèlerins fictifs.
// Il applique les mêmes droits que la vraie base, pour que la démo montre ce que voit chaque rôle.

import { CHAPITRES, CONTENUS, PERSONAS, dossiersExemple, membresExemple } from './exemples.js';
import { droits } from './modele.js';
import { CONFIG_DEPART, QUESTIONS_DEPART, erreursPersonne, totalPanier, versFiche } from './questionnaire.js';

const CLE = 'himmelsweg-demo-v2';
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
  const config = structuredClone(CONFIG_DEPART);
  const dossiers = dossiersExemple(membres, config.tarifs);
  return { membres, prive, liens, dossiers, contenus: CONTENUS, chapitres: CHAPITRES, questions: structuredClone(QUESTIONS_DEPART), config };
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
  const lienDe = (id) => Object.keys(etat.liens).find((k) => etat.liens[k] === id);
  const regler = (ref, statut, extra = {}) => {
    const d = etat.dossiers.find((x) => x.id === ref);
    etat.dossiers = etat.dossiers.map((x) => (x.id === ref ? { ...x, statut, regleLe: new Date().toISOString(), liensEnvoyes: true, ...extra } : x));
    etat.membres = etat.membres.map((m) => (d.membres.includes(m.id) ? { ...m, statut: 'inscrit' } : m));
    sauver();
  };
  const etatDossier = (ref) => {
    const d = etat.dossiers.find((x) => x.id === ref);
    if (!d) throw new Error('Inscription introuvable.');
    // En démo, on montre les liens que chacun recevrait par e-mail.
    const liensDemo = ['paye', 'gratuit', 'valide_main'].includes(d.statut)
      ? d.membres.map((id, i) => ({ nom: d.noms[i], url: `${location.origin}/?demo#cle=${lienDe(id)}` }))
      : [];
    return { statut: d.statut, montant: d.montant, noms: d.noms, liensDemo };
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

    // Questionnaire d'inscription (lisible par tous, même sans connexion)
    ecouterQuestions: (cb) => ecouter(() => etat.questions, cb),
    ecouterConfig: (cb) => ecouter(() => etat.config, cb),
    async enregistrerQuestion(q) {
      exigerAdmin();
      etat.questions = [...etat.questions.filter((x) => x.id !== q.id), q];
      sauver();
    },
    async enregistrerQuestions(liste) {
      exigerAdmin();
      const parId = Object.fromEntries(liste.map((q) => [q.id, q]));
      etat.questions = etat.questions.map((q) => parId[q.id] ?? q);
      sauver();
    },
    async supprimerQuestion(id) {
      exigerAdmin();
      etat.questions = etat.questions.filter((x) => x.id !== id || x.systeme);
      sauver();
    },
    async enregistrerConfig(c) {
      exigerAdmin();
      etat.config = c;
      sauver();
    },

    // Inscription publique : même contrôle que le script Google, paiement simulé.
    async inscrire({ personnes, payeur, don, reglement }) {
      await new Promise((r) => setTimeout(r, 400));
      if (!etat.config.ouverte) throw new Error('Les inscriptions sont fermées pour le moment.');
      if (reglement !== true) throw new Error('Le règlement doit être accepté.');
      if (personnes.some((p) => Object.keys(erreursPersonne(etat.questions, p, etat.config.tarifs)).length)) {
        throw new Error('Certaines réponses sont incomplètes.');
      }
      const donOk = etat.config.don ? Math.max(0, Math.round(Number(don) || 0)) : 0;
      const total = totalPanier(personnes, etat.config.tarifs, donOk);
      const ref = `d-${Date.now().toString(36)}`;
      const ids = [];
      const noms = [];
      personnes.forEach((p, i) => {
        const id = `i-${Date.now().toString(36)}-${i}`;
        const { membre, prive } = versFiche(etat.questions, p.groupe, p.reponses);
        etat.membres.push({
          ...membre,
          id,
          email: membre.email || payeur.email.toLowerCase(),
          chapitre: null,
          roles: ['pelerin'],
          inscritLe: new Date().toISOString().slice(0, 10),
          statut: total === 0 ? 'inscrit' : 'en_attente',
          tarif: p.tarif,
          dossier: ref,
        });
        etat.prive[id] = prive;
        etat.liens[`demo-${id}`] = id;
        ids.push(id);
        noms.push(`${membre.prenom} ${membre.nom}`);
      });
      etat.dossiers.push({
        id: ref,
        cree: new Date().toISOString(),
        statut: total === 0 ? 'gratuit' : 'en_attente',
        montant: total,
        don: donOk,
        payeur: { ...payeur, email: payeur.email.toLowerCase() },
        membres: ids,
        noms,
        relances: 0,
        liensEnvoyes: total === 0,
      });
      sauver();
      if (total === 0) return { ref, gratuit: true };
      return { ref, redirectUrl: `/inscription/demo-paiement?demo&ref=${ref}` };
    },
    async etatInscription(ref) {
      return etatDossier(ref);
    },
    async payerInscription(ref) {
      const e = etatDossier(ref);
      return e.statut === 'en_attente' ? { ...e, redirectUrl: `/inscription/demo-paiement?demo&ref=${ref}` } : e;
    },
    async simulerPaiement(ref) {
      regler(ref, 'paye');
    },

    ecouterDossiers: (cb) => ecouter(() => (session()?.estAdmin ? [...etat.dossiers] : []), cb),
    async validerDossier(ref, mode) {
      exigerAdmin();
      regler(ref, 'valide_main', { mode });
    },

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
      etat.membres = [...etat.membres, { roles: ['pelerin'], statut: 'inscrit', ...champs, id, inscritLe: new Date().toISOString().slice(0, 10) }];
      etat.prive = { ...etat.prive, [id]: prive ?? {} };
      sauver();
      return id;
    },
    async modifierMembre(id, champs) {
      exigerAdmin();
      etat.membres = etat.membres.map((m) => (m.id === id ? { ...m, ...champs } : m));
      sauver();
    },
    async modifierMesReponses(id, champs, prive) {
      if (session()?.id !== id && !session()?.estAdmin) throw new Error('Non autorisé');
      etat.membres = etat.membres.map((m) => (m.id === id ? { ...m, ...champs } : m));
      etat.prive = { ...etat.prive, [id]: prive };
      sauver();
    },
    async modifierPrive(id, champs) {
      exigerAdmin();
      etat.prive = { ...etat.prive, [id]: { ...etat.prive[id], ...champs } };
      sauver();
    },
    async lienPersonnel(id, { nouveau = false } = {}) {
      exigerAdmin();
      let cle = lienDe(id);
      if (!cle || nouveau) {
        if (cle) delete etat.liens[cle];
        cle = `demo-${id}-${Math.random().toString(36).slice(2, 8)}`;
        etat.liens = { ...etat.liens, [cle]: id };
        sauver();
      }
      return `${location.origin}/?demo#cle=${cle}`;
    },
  };
}
