// MODE DÉMO : tout est gardé dans le navigateur (localStorage), avec des pèlerins fictifs.
// Il applique les mêmes droits que la vraie base, pour que la démo montre ce que voit chaque rôle.

import { CHAPITRES, CONTENUS, PERSONAS, bilanExemple, dossiersExemple, membresExemple } from './exemples.js';
import { droits, estChoriste, sansRolesDeChapitre } from './modele.js';
import { REPERES_EXEMPLE, TRACES_EXEMPLE } from './carte.js';
import { PARCOURS_DEPART, REPAS_CONFIG_DEPART, compterRegimes, texteAlerte } from './equipes.js';
import { CONFIG_DEPART, QUESTIONS_DEPART, erreursPersonne, totalPanier, versFiche } from './questionnaire.js';

const CLE = 'himmelsweg-demo-v8';
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
  return {
    membres,
    prive,
    liens,
    dossiers,
    contenus: CONTENUS,
    chapitres: CHAPITRES,
    questions: structuredClone(QUESTIONS_DEPART),
    config,
    configApp: { smsAlerte: '06 00 00 00 00' },
    repas: { ...structuredClone(REPAS_CONFIG_DEPART), extras: 8 },
    listes: {
      fournisseurs: [
        { id: 'f1', nom: 'Boulangerie Muller', tel: '03 88 00 00 01', livre: 'Pain, viennoiseries', quand: 'Samedi et dimanche, 6 h 30', prix: 'Environ 1 € la baguette' },
        { id: 'f2', nom: 'Traiteur du Ried', tel: '03 89 00 00 02', livre: 'Plat chaud du samedi soir', quand: 'Samedi 18 h', prix: '9 € par personne' },
      ],
      parcours: structuredClone(PARCOURS_DEPART),
      traces: structuredClone(TRACES_EXEMPLE),
      reperes: structuredClone(REPERES_EXEMPLE),
      positions: [
        ...membres
          .filter((m) => m.id === 'm-F1')
          .map((m) => ({ id: m.id, lat: 48.2391, lng: 7.3655, precision: 15, maj: new Date(Date.now() - 4 * 60000).toISOString(), nom: `${m.prenom} ${m.nom}`, chapitre: m.chapitre })),
      ],
      prevoyance: [
        { id: 'p1', objet: 'Tentes de secours', quantite: '4', responsable: 'Damien', fait: true },
        { id: 'p2', objet: 'Trousses de premiers secours', quantite: '1 par chapitre', responsable: 'Damien', fait: false },
        { id: 'p3', objet: 'Camionnette pour les gros sacs', quantite: '1', responsable: 'Louis', fait: false },
      ],
    },
    fils: {
      logistique: [{ id: 'x1', auteur: 'm-H4', nom: 'Damien Weber', texte: 'Qui peut récupérer la camionnette jeudi soir ?', le: '2027-05-01T18:00:00Z' }],
      repas: [{ id: 'x2', auteur: 'm-F4', nom: 'Domitille Hartmann', texte: 'J’ai appelé la boulangerie, c’est bon pour samedi.', le: '2027-04-28T09:30:00Z' }],
      chef: [],
      securite: [],
      admins: [],
    },
    alertes: [],
    photos: [],
    configBilan: {},
    ...bilanExemple(membres),
  };
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
  const aRole = (...r) => {
    const s = session();
    return !!s && (s.estAdmin || r.some((x) => s.roles?.includes(x)));
  };
  const exigerRole = (...r) => {
    if (!aRole(...r)) throw new Error('Réservé à l’équipe concernée.');
  };
  const DROITS_LISTES = {
    fournisseurs: { lire: ['repas'], ecrire: ['repas'] },
    parcours: { lire: ['pelerin', 'logistique', 'chef', 'securite'], ecrire: ['logistique'] },
    traces: { lire: ['pelerin', 'logistique', 'chef', 'securite'], ecrire: ['logistique'] },
    reperes: { lire: ['pelerin', 'logistique', 'chef', 'securite'], ecrire: ['logistique'] },
    positions: { lire: ['logistique'], ecrire: ['chef'] },
    prevoyance: { lire: ['logistique'], ecrire: ['logistique'] },
  };
  const lienDe = (id) => Object.keys(etat.liens).find((k) => etat.liens[k] === id);
  // Comme le script : l'ami qui a invité gagne +1 par personne, une fois l'inscription confirmée.
  const compterInvites = (ref) => {
    const d = etat.dossiers.find((x) => x.id === ref);
    if (!d?.invitePar) return;
    etat.membres = etat.membres.map((m) => (m.id === d.invitePar ? { ...m, amisInscrits: (m.amisInscrits ?? 0) + d.membres.length } : m));
  };
  const regler = (ref, statut, extra = {}) => {
    const d = etat.dossiers.find((x) => x.id === ref);
    etat.dossiers = etat.dossiers.map((x) => (x.id === ref ? { ...x, statut, regleLe: new Date().toISOString(), liensEnvoyes: true, ...extra } : x));
    if (!d.liensEnvoyes) compterInvites(ref);
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

    // Le nom du chef est recopié sur le chapitre (les pèlerins ne lisent pas les fiches des autres).
    ecouterChapitres: (cb) =>
      ecouter(() => {
        if (!session()) return [];
        return etat.chapitres.map((c) => {
          const chef = etat.membres.find((m) => m.chapitre === c.id && m.roles?.includes('chef'));
          return { ...c, chef: chef ? `${chef.prenom} ${chef.nom}` : null };
        });
      }, cb),
    async enregistrerChapitre({ id, ...c }) {
      exigerAdmin();
      const cle = id || `ch-${Date.now().toString(36)}`;
      etat.chapitres = [...etat.chapitres.filter((x) => x.id !== cle), { ...c, id: cle }];
      sauver();
      return cle;
    },
    async supprimerChapitre(id) {
      exigerAdmin();
      etat.membres = etat.membres.map((m) => (m.chapitre === id ? { ...m, chapitre: null, roles: sansRolesDeChapitre(m.roles) } : m));
      etat.chapitres = etat.chapitres.filter((x) => x.id !== id);
      sauver();
    },

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
    async inscrire({ personnes, payeur, don, reglement, invite }) {
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
          ...(etat.membres.some((m) => m.id === invite) ? { invitePar: invite } : {}),
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
        ...(etat.membres.some((m) => m.id === invite) ? { invitePar: invite } : {}),
      });
      if (total === 0) compterInvites(ref);
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

    // Outils des équipes
    ecouterConfigApp: (cb) => ecouter(() => (session() ? etat.configApp : {}), cb),
    async enregistrerConfigApp(c) {
      exigerAdmin();
      etat.configApp = c;
      sauver();
    },
    ecouterRepas: (cb) => ecouter(() => (aRole('repas') ? etat.repas : null), cb),
    async enregistrerRepas(c) {
      exigerRole('repas');
      etat.repas = c;
      sauver();
    },
    ecouterStatsRepas: (cb) =>
      ecouter(() => (aRole('repas', 'logistique') ? { ...compterRegimes(etat.membres, etat.prive), maj: new Date().toISOString() } : null), cb),
    ecouterListe: (nom, cb) => ecouter(() => (aRole(...DROITS_LISTES[nom].lire) ? [...etat.listes[nom]] : []), cb),
    async enregistrerElement(nom, el) {
      exigerRole(...DROITS_LISTES[nom].ecrire);
      const id = el.id || `${nom[0]}-${Date.now().toString(36)}`;
      etat.listes[nom] = [...etat.listes[nom].filter((x) => x.id !== id), { ...el, id }];
      sauver();
      return id;
    },
    async supprimerElement(nom, id) {
      exigerRole(...DROITS_LISTES[nom].ecrire);
      etat.listes[nom] = etat.listes[nom].filter((x) => x.id !== id);
      sauver();
    },
    // Photos : en démo, la « photo en grand » est la vignette (rien ne part dans un Drive).
    async envoyerPhoto(p) {
      const s = session();
      if (!s) throw new Error('Session expirée.');
      await new Promise((ok) => setTimeout(ok, 300));
      if (etat.photos.some((x) => x.id === p.id)) return;
      etat.photos = [
        ...etat.photos,
        { id: p.id, auteur: s.id, nom: `${s.prenom} ${s.nom}`.trim(), chapitre: s.chapitre ?? null, statut: 'a_trier', vignette: p.vignette, largeur: p.largeur, hauteur: p.hauteur, prise: p.prise, le: new Date().toISOString() },
      ];
      sauver();
    },
    async trierPhoto(id, statut) {
      exigerAdmin();
      etat.photos = etat.photos.map((x) => (x.id === id ? { ...x, statut, trieeLe: new Date().toISOString() } : x));
      sauver();
    },
    async supprimerPhoto(id) {
      const s = session();
      const p = etat.photos.find((x) => x.id === id);
      if (p && !s?.estAdmin && !(p.auteur === s?.id && p.statut === 'a_trier')) throw new Error('Vous ne pouvez plus retirer cette photo.');
      etat.photos = etat.photos.filter((x) => x.id !== id);
      sauver();
    },
    // Questionnaire de fin
    ecouterConfigBilan: (cb) => ecouter(() => (session() ? etat.configBilan : {}), cb),
    async enregistrerConfigBilan(c) {
      exigerAdmin();
      etat.configBilan = { ...etat.configBilan, ...c };
      sauver();
    },
    ecouterMonBilan: (cb) => ecouter(() => !!session() && etat.bilanFait.some((f) => f.id === session().id), cb),
    async envoyerBilan(r) {
      const s = session();
      if (!s || s.estAdmin) throw new Error('Réservé aux pèlerins.');
      if (etat.bilanFait.some((f) => f.id === s.id)) throw new Error('Vous avez déjà répondu.');
      etat.bilan.push({ ...r, id: r.anonyme ? `b-${Date.now().toString(36)}` : s.id });
      etat.bilanFait.push({ id: s.id, jour: r.jour });
      sauver();
    },
    ecouterBilans: (cb) => ecouter(() => (session()?.estAdmin ? [...etat.bilan] : []), cb),
    ecouterBilansFaits: (cb) => ecouter(() => (session()?.estAdmin ? [...etat.bilanFait] : []), cb),
    async retenirTemoignage(id, retenu) {
      exigerAdmin();
      etat.bilan = etat.bilan.map((b) => (b.id === id ? { ...b, retenu } : b));
      sauver();
    },
    ecouterPhotos: (quoi, n, cb) =>
      ecouter(() => {
        const s = session();
        if (!s) return [];
        const l =
          quoi === 'miennes'
            ? etat.photos.filter((p) => p.auteur === s.id)
            : quoi === 'galerie'
              ? etat.photos.filter((p) => p.statut === 'publiee')
              : s.estAdmin
                ? etat.photos.filter((p) => p.statut === 'a_trier')
                : [];
        return [...l].sort((a, b) => a.id.localeCompare(b.id)).slice(0, n);
      }, cb),
    ecouterFil: (equipe, cb) =>
      ecouter(() => {
        const s = session();
        const ok = s && (s.estAdmin || (equipe !== 'admins' && s.roles?.includes(equipe)));
        return ok ? [...etat.fils[equipe]].sort((a, b) => a.le.localeCompare(b.le)) : [];
      }, cb),
    async ecrireFil(equipe, texte) {
      const s = session();
      if (!s || !(s.estAdmin || (equipe !== 'admins' && s.roles?.includes(equipe)))) throw new Error('Non autorisé');
      etat.fils[equipe] = [...etat.fils[equipe], { id: `x-${Date.now()}`, auteur: s.id, nom: `${s.prenom} ${s.nom}`.trim(), texte, le: new Date().toISOString() }];
      sauver();
    },
    async lancerAlerte({ message, position }) {
      exigerRole('securite');
      const s = session();
      const chapitre = etat.chapitres.find((c) => c.id === s.chapitre)?.nom ?? '';
      const alerte = { id: `al-${Date.now()}`, auteur: s.id, nom: `${s.prenom} ${s.nom}`.trim(), chapitre, message, position, le: new Date().toISOString(), traitee: false };
      etat.alertes = [alerte, ...etat.alertes];
      sauver();
      const prevenus = etat.membres.filter((m) => m.roles?.includes('logistique')).length;
      return { texte: texteAlerte(alerte), prevenus };
    },
    ecouterAlertes: (cb) =>
      ecouter(() => {
        const s = session();
        if (!s) return [];
        return aRole('logistique') ? [...etat.alertes] : etat.alertes.filter((a) => a.auteur === s.id);
      }, cb),
    async traiterAlerte(id) {
      exigerRole('logistique');
      etat.alertes = etat.alertes.map((a) => (a.id === id ? { ...a, traitee: true } : a));
      sauver();
    },
    async nommerAdjoint(id, oui) {
      const s = session();
      const m = etat.membres.find((x) => x.id === id);
      if (!s?.roles?.includes('chef') || !s.chapitre || m?.chapitre !== s.chapitre) throw new Error('Réservé au chef de ce chapitre.');
      const roles = new Set(m.roles ?? []);
      oui ? roles.add('securite') : roles.delete('securite');
      etat.membres = etat.membres.map((x) => (x.id === id ? { ...x, roles: [...roles] } : x));
      sauver();
    },
    notifications: 'demo',
    async activerNotifications() {
      return 'Notifications activées (démo).';
    },
    // Site : en démo, on part des vrais textes du site et rien ne part sur GitHub.
    async siteLire() {
      exigerAdmin();
      return (await import('./site-demo.js')).lireDemo();
    },
    async siteEcrire(chemin, contenu) {
      exigerAdmin();
      return (await import('./site-demo.js')).ecrireDemo(chemin, contenu);
    },
    async sitePhoto(chemin) {
      exigerAdmin();
      return (await import('./site-demo.js')).photoDemo(chemin);
    },
    async siteSupprimer(chemin) {
      exigerAdmin();
      return (await import('./site-demo.js')).supprimerDemo(chemin);
    },
    async envoyerNotification({ cible, valeur }) {
      exigerAdmin();
      const n = etat.membres.filter(
        (m) => m.statut !== 'en_attente' && (cible === 'tous' || (cible === 'chapitre' && m.chapitre === valeur) || (cible === 'role' && (m.roles?.includes(valeur) || (valeur === 'chorale' && estChoriste(m))))),
      ).length;
      return { envoyes: n, demo: true };
    },
    async supprimerMembre(id) {
      exigerAdmin();
      etat.membres = etat.membres.filter((m) => m.id !== id);
      delete etat.prive[id];
      Object.keys(etat.liens).forEach((k) => etat.liens[k] === id && delete etat.liens[k]);
      etat.dossiers = etat.dossiers.map((d) => (d.membres.includes(id) ? { ...d, membres: d.membres.filter((x) => x !== id) } : d));
      sauver();
    },
    async annulerDossier(ref) {
      exigerAdmin();
      const d = etat.dossiers.find((x) => x.id === ref);
      for (const id of d?.membres ?? []) await this.supprimerMembre(id);
      etat.dossiers = etat.dossiers.map((x) => (x.id === ref ? { ...x, statut: 'annule' } : x));
      sauver();
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
