/**
 * Script Google de l'application app.himmelsweg.fr
 * (projet Apps Script séparé de celui des formulaires du site).
 *
 * Il tourne sur le compte pelerinagehimmelsweg@gmail.com et fait quatre choses :
 *  1. il reçoit les inscriptions remplies dans l'app (app.himmelsweg.fr/inscription),
 *     vérifie les réponses et le prix, crée les fiches puis prépare le paiement HelloAsso ;
 *  2. toutes les 15 minutes, il regarde les paiements reçus, envoie les liens personnels
 *     et relance les inscriptions non payées (après 3 jours puis 10 jours) ;
 *  3. il envoie les e-mails depuis Gmail, au nom de secretariat@himmelsweg.fr ;
 *  4. quand quelqu'un ouvre son lien, il vérifie la clé et ouvre sa session dans l'app ;
 *  5. il enregistre sur GitHub les modifications du site faites dans l'app (écran « Site » des admins).
 *
 * Réglages : Paramètres du projet → Propriétés du script (jamais dans le code ni dans un chat).
 *   HELLOASSO_CLIENT_ID, HELLOASSO_CLIENT_SECRET : clé API HelloAsso
 *   HELLOASSO_ORGANISATION : association-pour-le-culte-catholique-traditionnel-en-alsace
 *   FIREBASE_CLE : contenu complet du fichier JSON de la clé du compte de service Firebase
 *   GITHUB_CLE : clé GitHub limitée au dépôt himmelsweg (droit « Contents : read and write »)
 * Installation pas à pas : google/app/README.md
 */

const PROJET_FIREBASE = 'himmelsweg-cbd26';
const ADRESSE_APP = 'https://app.himmelsweg.fr';
const EXPEDITEUR = 'secretariat@himmelsweg.fr';
const API_HELLOASSO = 'https://api.helloasso.com';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJET_FIREBASE}/databases/(default)/documents`;
const RELANCES_JOURS = [3, 10];
const MAX_PERSONNES = 10;
// Clé web publique du projet Firebase (la même que dans l'app) : sert à vérifier qui appelle.
const CLE_WEB = 'AIzaSyAr-mO39_gnd3-nzPpzyqXD7ns5xpruWtA';
// Site himmelsweg.fr : textes et photos dans le dépôt GitHub, publiés à chaque modification de main.
const DEPOT_SITE = 'pelerinagehimmelsweg-creator/himmelsweg';
const BRANCHE_SITE = 'main';
const SITE_TEXTES = /^site\/src\/content\/(pages\/[a-z0-9-]+\.md|site\/[a-z0-9-]+\.yml)$/;
const SITE_PHOTOS = /^site\/src\/assets\/photos\/[a-z0-9-]+\.(jpg|jpeg|png|webp|gif)$/;

/* ------------------------------------------------------------------ */
/* À lancer une fois à la main : vérifie les réglages et programme le  */
/* suivi automatique toutes les 15 minutes.                           */
/* ------------------------------------------------------------------ */

function installer() {
  const p = PropertiesService.getScriptProperties().getProperties();
  const manque = ['HELLOASSO_CLIENT_ID', 'HELLOASSO_CLIENT_SECRET', 'HELLOASSO_ORGANISATION', 'FIREBASE_CLE'].filter((k) => !p[k]);
  if (manque.length) throw new Error('Réglages manquants dans les propriétés du script : ' + manque.join(', '));
  ScriptApp.getProjectTriggers()
    .filter((t) => ['suivre', 'synchroniser'].indexOf(t.getHandlerFunction()) !== -1)
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('suivre').timeBased().everyMinutes(15).create();
  jetonGoogle_(); // vérifie la clé Firebase
  jetonHelloAsso_(); // vérifie la clé HelloAsso
  Logger.log('Installation terminée. Paiements et relances suivis toutes les 15 minutes.');
  Logger.log('Alias Gmail ' + EXPEDITEUR + (GmailApp.getAliases().indexOf(EXPEDITEUR) === -1 ? ' INTROUVABLE : les e-mails partiront de l’adresse Gmail.' : ' trouvé.'));
}

/* ------------------------------------------------------------------ */
/* Appels de l'app                                                     */
/* ------------------------------------------------------------------ */

function doPost(e) {
  let demande = {};
  try {
    demande = JSON.parse((e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ erreur: 'Demande invalide.' });
  }
  try {
    if (demande.action === 'connexion') return json_(connexion_(demande));
    if (demande.action === 'inscription') return json_(inscrire_(demande));
    if (demande.action === 'payer') return json_(payer_(demande.ref));
    if (demande.action === 'verifier') return json_(verifier_(demande.ref));
    if (demande.action === 'notifier') return json_(notifier_(demande));
    if (demande.action === 'site') return json_(site_(demande));
    return json_({ erreur: 'Demande invalide.' });
  } catch (err) {
    console.error(err);
    if (err.pourLaPersonne) return json_({ erreur: err.message, details: err.details });
    return json_({ erreur: 'Le service est momentanément indisponible. Réessayez dans quelques minutes.' });
  }
}

function refus_(message, details) {
  const e = new Error(message);
  e.pourLaPersonne = true;
  e.details = details;
  return e;
}

function connexion_(demande) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(demande.cle || '')) return { erreur: 'Demande invalide.' };
  const lien = lireDocument_('liens/' + demande.cle);
  if (!lien || !lien.membreId) return { erreur: 'Ce lien n’est plus valable. Demandez-en un nouveau au secrétariat.' };
  return { jeton: jetonDeConnexion_(lien.membreId) };
}

/* ------------------------------------------------------------------ */
/* 1. Inscription                                                     */
/* ------------------------------------------------------------------ */

/**
 * demande = { personnes: [{ groupe, tarif, reponses }], payeur: { prenom, nom, email },
 *             don (centimes), reglement: true, piege: '' (case invisible anti-robots) }
 * Le prix est recalculé ici, à partir des tarifs de la base : l'app ne peut pas le choisir.
 */
function inscrire_(d) {
  if (d.piege) return { ref: 'ok', gratuit: true }; // robot : on fait semblant
  freiner_();
  const config = lireDocument_('config/inscription');
  if (!config || !config.ouverte) throw refus_('Les inscriptions sont fermées pour le moment.');
  const questions = listerCollection_('questions');
  if (!questions.length) throw refus_('Le questionnaire n’est pas encore prêt.');

  const personnes = Array.isArray(d.personnes) ? d.personnes : [];
  if (!personnes.length || personnes.length > MAX_PERSONNES) throw refus_('Entre 1 et ' + MAX_PERSONNES + ' personnes par inscription.');
  if (JSON.stringify(d).length > 2000000) throw refus_('Inscription trop volumineuse (signatures ?).');
  const payeur = d.payeur || {};
  const emailPayeur = String(payeur.email || '').trim().toLowerCase();
  if (!String(payeur.prenom || '').trim() || !String(payeur.nom || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPayeur)) {
    throw refus_('Coordonnées de la personne qui paie incomplètes.');
  }
  if (d.reglement !== true) throw refus_('Le règlement doit être accepté.');
  const erreurs = personnes.map((p) => erreursPersonne(questions, { groupe: p.groupe, tarif: p.tarif, reponses: p.reponses || {} }, config.tarifs));
  if (erreurs.some((e) => Object.keys(e).length)) throw refus_('Certaines réponses sont incomplètes.', erreurs);

  const don = config.don ? Math.min(1000000, Math.max(0, Math.round(Number(d.don) || 0))) : 0;
  const total = totalPanier(personnes, config.tarifs, don);
  const ref = nouvelleCle_();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const ecritures = [];
  const ids = [];
  const noms = [];
  personnes.forEach((p) => {
    const id = 'i-' + nouvelleCle_().slice(0, 20);
    const fiche = versFiche(questions, p.groupe, p.reponses || {});
    const membre = Object.assign(fiche.membre, {
      email: fiche.membre.email || emailPayeur,
      chapitre: null,
      roles: ['pelerin'],
      inscritLe: aujourdhui,
      statut: total === 0 ? 'inscrit' : 'en_attente',
      tarif: p.tarif,
      dossier: ref,
    });
    const cle = nouvelleCle_();
    ids.push(id);
    noms.push((membre.prenom + ' ' + membre.nom).trim());
    ecritures.push(
      ecriture_('membres/' + id, membre, { existe: false }),
      ecriture_(`membres/${id}/prive/fiche`, fiche.prive),
      ecriture_('liens/' + cle, { membreId: id, cree: new Date() }),
      ecriture_(`membres/${id}/admin/lien`, { cle }),
    );
  });
  const dossier = {
    cree: new Date(),
    statut: total === 0 ? 'gratuit' : 'en_attente',
    montant: total,
    don,
    payeur: { prenom: String(payeur.prenom).trim(), nom: String(payeur.nom).trim(), email: emailPayeur, tel: String(payeur.tel || '').trim() },
    membres: ids,
    noms,
    relances: 0,
    liensEnvoyes: false,
  };
  ecritures.unshift(ecriture_('dossiers/' + ref, dossier, { existe: false }));
  enregistrer_(ecritures);

  if (total === 0) {
    envoyerLiensDuDossier_(ref);
    return { ref, gratuit: true };
  }
  return { ref, redirectUrl: nouveauPaiement_(ref, dossier) };
}

/** Pas plus de 30 inscriptions en 10 minutes (protection contre les robots). */
function freiner_() {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('inscriptions_recentes') || 0);
  if (n >= 30) throw refus_('Beaucoup d’inscriptions en ce moment : réessayez dans quelques minutes.');
  cache.put('inscriptions_recentes', String(n + 1), 600);
}

/* ------------------------------------------------------------------ */
/* 2. Paiement HelloAsso (Checkout)                                    */
/* ------------------------------------------------------------------ */

function nouveauPaiement_(ref, dossier) {
  const org = PropertiesService.getScriptProperties().getProperty('HELLOASSO_ORGANISATION');
  const n = dossier.membres.length;
  const corps = {
    totalAmount: dossier.montant,
    initialAmount: dossier.montant,
    itemName: ('Pèlerinage Himmelsweg 2027 : ' + n + ' inscription' + (n > 1 ? 's' : '') + (dossier.don ? ' et un don' : '')).slice(0, 250),
    backUrl: `${ADRESSE_APP}/inscription/payer?ref=${ref}`,
    errorUrl: `${ADRESSE_APP}/inscription/payer?ref=${ref}&erreur=1`,
    returnUrl: `${ADRESSE_APP}/inscription/merci?ref=${ref}`,
    containsDonation: dossier.don > 0,
    payer: { firstName: dossier.payeur.prenom, lastName: dossier.payeur.nom, email: dossier.payeur.email },
    metadata: { ref },
  };
  const envoyer = () =>
    UrlFetchApp.fetch(`${API_HELLOASSO}/v5/organizations/${encodeURIComponent(org)}/checkout-intents`, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + jetonHelloAsso_() },
      payload: JSON.stringify(corps),
      muteHttpExceptions: true,
    });
  let rep = envoyer();
  // HelloAsso refuse certains noms (« test », prénom = nom, chiffres…) : on le laisse alors demander le payeur sur sa page.
  if (rep.getResponseCode() === 400 && corps.payer) {
    console.error('HelloAsso refuse le payeur, nouvel essai sans : ' + rep.getContentText().slice(0, 500));
    delete corps.payer;
    rep = envoyer();
  }
  if (rep.getResponseCode() !== 200) {
    console.error('HelloAsso refuse le paiement (' + rep.getResponseCode() + ') : ' + rep.getContentText().slice(0, 1000));
    throw refus_('HelloAsso refuse de préparer le paiement' + messageHelloAsso_(rep) + '. Votre inscription est enregistrée : le secrétariat vous recontacte, ou réessayez plus tard.');
  }
  const intention = JSON.parse(rep.getContentText());
  const anciens = (dossier.paiements || []).concat(dossier.checkoutId ? [dossier.checkoutId] : []);
  modifier_('dossiers/' + ref, { checkoutId: String(intention.id), paiements: anciens.map(String) });
  return intention.redirectUrl;
}

/** Message d'erreur lisible renvoyé par HelloAsso, s'il y en a un. */
function messageHelloAsso_(rep) {
  try {
    const j = JSON.parse(rep.getContentText());
    const m = (j.errors || []).map((e) => e.message).filter(Boolean).join(' ; ') || j.message || '';
    return m ? ' (' + String(m).slice(0, 200) + ')' : ' (code ' + rep.getResponseCode() + ')';
  } catch (e) {
    return ' (code ' + rep.getResponseCode() + ')';
  }
}

/** Nouveau lien de paiement pour une inscription en attente (bouton « Payer » ou e-mail de relance). */
function payer_(ref) {
  const dossier = dossierValide_(ref);
  const etat = etatPaiement_(ref, dossier);
  if (etat.statut !== 'en_attente') return etat;
  return Object.assign(etat, { redirectUrl: nouveauPaiement_(ref, dossier) });
}

/** État d'une inscription, en vérifiant auprès de HelloAsso si elle a été payée. */
function verifier_(ref) {
  return etatPaiement_(ref, dossierValide_(ref));
}

function dossierValide_(ref) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(ref || '')) throw refus_('Inscription introuvable.');
  const dossier = lireDocument_('dossiers/' + ref);
  if (!dossier) throw refus_('Inscription introuvable.');
  return dossier;
}

function etatPaiement_(ref, dossier) {
  if (dossier.statut === 'en_attente') {
    const paye = [dossier.checkoutId].concat(dossier.paiements || []).filter(Boolean).some((id) => intentionPayee_(id));
    if (paye) {
      marquerRegle_(ref, dossier, 'paye');
      dossier.statut = 'paye';
    }
  }
  return { statut: dossier.statut, montant: dossier.montant, noms: dossier.noms || [] };
}

function intentionPayee_(id) {
  const org = PropertiesService.getScriptProperties().getProperty('HELLOASSO_ORGANISATION');
  const rep = UrlFetchApp.fetch(`${API_HELLOASSO}/v5/organizations/${encodeURIComponent(org)}/checkout-intents/${encodeURIComponent(id)}`, {
    headers: { Authorization: 'Bearer ' + jetonHelloAsso_() },
    muteHttpExceptions: true,
  });
  if (rep.getResponseCode() !== 200) return false;
  const json = JSON.parse(rep.getContentText());
  const paiements = (json.order && json.order.payments) || [];
  return !!json.order && (paiements.length === 0 || paiements.some((p) => ['Authorized', 'Registered', 'Processed'].indexOf(p.state) !== -1));
}

/** Paiement reçu : les fiches passent « inscrit » et chacun reçoit son lien. */
function marquerRegle_(ref, dossier, statut) {
  enregistrer_(
    [ecriture_('dossiers/' + ref, { statut, regleLe: new Date() }, { champs: ['statut', 'regleLe'] })].concat(
      dossier.membres.map((id) => ecriture_('membres/' + id, { statut: 'inscrit' }, { champs: ['statut'] })),
    ),
  );
  envoyerLiensDuDossier_(ref);
}

function jetonHelloAsso_() {
  const cache = CacheService.getScriptCache();
  const enCache = cache.get('jeton_helloasso');
  if (enCache) return enCache;
  const p = PropertiesService.getScriptProperties();
  const rep = UrlFetchApp.fetch(API_HELLOASSO + '/oauth2/token', {
    method: 'post',
    payload: {
      grant_type: 'client_credentials',
      client_id: p.getProperty('HELLOASSO_CLIENT_ID'),
      client_secret: p.getProperty('HELLOASSO_CLIENT_SECRET'),
    },
    muteHttpExceptions: true,
  });
  if (rep.getResponseCode() !== 200) throw new Error('HelloAsso refuse la clé API (' + rep.getResponseCode() + ').');
  const json = JSON.parse(rep.getContentText());
  cache.put('jeton_helloasso', json.access_token, Math.min(1500, (json.expires_in || 1800) - 120));
  return json.access_token;
}

/* ------------------------------------------------------------------ */
/* 3. Suivi toutes les 15 minutes : paiements, liens, relances         */
/* ------------------------------------------------------------------ */

function suivre() {
  try {
    majStatsRepas_();
  } catch (err) {
    console.error('Comptes des repas : ' + err.message);
  }
  const maintenant = Date.now();
  listerCollection_('dossiers').forEach((dossier) => {
    const ref = dossier.id;
    try {
      if (dossier.statut === 'en_attente') {
        const etat = etatPaiement_(ref, dossier);
        if (etat.statut !== 'en_attente') return;
        const jours = (maintenant - new Date(dossier.cree).getTime()) / 86400000;
        const n = dossier.relances || 0;
        if (n < RELANCES_JOURS.length && jours >= RELANCES_JOURS[n]) {
          envoyerRelance_(ref, dossier);
          modifier_('dossiers/' + ref, { relances: n + 1 });
        }
      } else if (['paye', 'gratuit', 'valide_main'].indexOf(dossier.statut) !== -1 && !dossier.liensEnvoyes) {
        // Validé à la main par un admin (chèque, espèces…) : on passe les fiches « inscrit » et on envoie les liens.
        if (dossier.statut === 'valide_main') {
          enregistrer_(dossier.membres.map((id) => ecriture_('membres/' + id, { statut: 'inscrit' }, { champs: ['statut'] })));
        }
        envoyerLiensDuDossier_(ref);
      }
    } catch (err) {
      console.error('Inscription ' + ref + ' : ' + err.message);
    }
  });
}

/** Envoie à chaque personne du dossier son lien personnel, une seule fois. */
function envoyerLiensDuDossier_(ref) {
  const verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    const dossier = lireDocument_('dossiers/' + ref);
    if (!dossier || dossier.liensEnvoyes) return;
    dossier.membres.forEach((id) => {
      const membre = lireDocument_('membres/' + id);
      const lien = lireDocument_(`membres/${id}/admin/lien`);
      const email = (membre && membre.email) || dossier.payeur.email;
      if (!membre || !lien || !lien.cle || !email) return;
      try {
        envoyerLien_(Object.assign({}, membre, { email }), lien.cle);
      } catch (err) {
        console.error('E-mail non envoyé à ' + email + ' : ' + err.message + ' (lien visible dans l’app, fiche du pèlerin).');
      }
    });
    modifier_('dossiers/' + ref, { liensEnvoyes: true });
  } finally {
    verrou.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Comptes pour l'équipe repas et notifications                       */
/* ------------------------------------------------------------------ */

/** Nombre d'inscrits confirmés par régime, sans aucun nom : seule chose que l'équipe repas voit. */
function majStatsRepas_() {
  const membres = listerCollection_('membres').filter((m) => m.statut !== 'en_attente');
  const regimes = {};
  requeteGroupe_('prive').forEach((d) => {
    const morceaux = d.chemin.split('/');
    if (morceaux[0] === 'membres' && morceaux[2] === 'prive' && morceaux[3] === 'fiche') regimes[morceaux[1]] = d.valeurs.regime;
  });
  const parRegime = {};
  membres.forEach((m) => {
    const r = regimes[m.id] || 'Non précisé';
    parRegime[r] = (parRegime[r] || 0) + 1;
  });
  enregistrer_([ecriture_('stats/repas', { total: membres.length, parRegime, maj: new Date() })]);
}

/** Qui appelle ? Vérifie la session Firebase envoyée par l'app. */
function qui_(idToken) {
  const rep = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + CLE_WEB, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ idToken: String(idToken || '') }),
    muteHttpExceptions: true,
  });
  if (rep.getResponseCode() !== 200) throw refus_('Session expirée : rouvrez l’app et réessayez.');
  const u = (JSON.parse(rep.getContentText()).users || [])[0];
  if (!u) throw refus_('Session expirée : rouvrez l’app et réessayez.');
  const email = u.email && u.emailVerified ? String(u.email).toLowerCase() : '';
  return { uid: u.localId, email, admin: !!email && !!lireDocument_('admins/' + encodeURIComponent(email)) };
}

/**
 * Notification sur les téléphones.
 * cible : 'tous' | 'chapitre' | 'role' (admins seulement) ou 'alerte' (l'adjoint sécurité qui l'a lancée).
 */
function notifier_(d) {
  const appelant = qui_(d.idToken);
  const membres = listerCollection_('membres').filter((m) => m.statut !== 'en_attente');
  let destinataires;
  let titre;
  let texte;
  if (d.cible === 'alerte') {
    const alerte = /^[A-Za-z0-9_-]{1,64}$/.test(d.valeur || '') && lireDocument_('alertes/' + d.valeur);
    if (!alerte || alerte.auteur !== appelant.uid) throw refus_('Alerte introuvable.');
    destinataires = membres.filter((m) => (m.roles || []).indexOf('logistique') !== -1);
    titre = 'Alerte accident';
    texte = alerte.nom + (alerte.chapitre ? ' (chapitre ' + alerte.chapitre + ')' : '') + (alerte.message ? ' : ' + alerte.message : '') +
      (alerte.position ? ' – position : https://maps.google.com/?q=' + alerte.position.lat + ',' + alerte.position.lng : '');
  } else {
    if (!appelant.admin) throw refus_('Réservé aux administrateurs.');
    titre = String(d.titre || '').trim().slice(0, 80);
    texte = String(d.texte || '').trim().slice(0, 500);
    if (!titre || !texte) throw refus_('Écrivez un titre et un message.');
    destinataires = membres.filter((m) =>
      d.cible === 'tous' ? true : d.cible === 'chapitre' ? m.chapitre === d.valeur : d.cible === 'role' ? (m.roles || []).indexOf(d.valeur) !== -1 || (d.valeur === 'chorale' && (m.reponses || {}).chorale === 'Oui') : false,
    );
  }
  return envoyerNotifications_(destinataires.map((m) => m.id), titre, texte);
}

function envoyerNotifications_(ids, titre, texte) {
  const voulus = {};
  ids.forEach((id) => (voulus[id] = true));
  const jetons = listerCollection_('jetons').filter((j) => voulus[j.id] && j.token);
  let envoyes = 0;
  const perimes = [];
  jetons.forEach((j) => {
    const rep = UrlFetchApp.fetch(`https://fcm.googleapis.com/v1/projects/${PROJET_FIREBASE}/messages:send`, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + jetonGoogle_() },
      payload: JSON.stringify({
        message: {
          token: j.token,
          webpush: {
            notification: { title: titre, body: texte, icon: ADRESSE_APP + '/icone-192.png' },
            fcm_options: { link: ADRESSE_APP + '/' },
          },
        },
      }),
      muteHttpExceptions: true,
    });
    if (rep.getResponseCode() === 200) envoyes++;
    else if (rep.getResponseCode() === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(rep.getContentText())) perimes.push(j.id);
  });
  if (perimes.length) enregistrer_(perimes.map((id) => ({ delete: nomDocument_('jetons/' + id) })));
  return { envoyes, destinataires: ids.length, sansNotification: ids.length - envoyes };
}

/** Tous les documents d'une sous-collection, quel que soit le parent (ex. toutes les fiches « prive »). */
function requeteGroupe_(collection) {
  const rep = UrlFetchApp.fetch(FIRESTORE + ':runQuery', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + jetonGoogle_() },
    payload: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection, allDescendants: true }] } }),
    muteHttpExceptions: true,
  });
  if (rep.getResponseCode() !== 200) throw new Error('Firebase illisible (' + rep.getResponseCode() + ').');
  return JSON.parse(rep.getContentText())
    .filter((r) => r.document)
    .map((r) => ({ chemin: r.document.name.split('/documents/')[1], valeurs: depuisChamps(r.document.fields || {}) }));
}

/* ------------------------------------------------------------------ */
/* Base Firebase (Firestore)                                          */
/* ------------------------------------------------------------------ */

const nomDocument_ = (chemin) => `projects/${PROJET_FIREBASE}/databases/(default)/documents/${chemin}`;

/** Une écriture pour enregistrer_ : document entier, ou seulement certains champs. */
function ecriture_(chemin, valeurs, options) {
  const o = options || {};
  const w = { update: { name: nomDocument_(chemin), fields: enChamps(valeurs) } };
  if (o.existe === false) w.currentDocument = { exists: false };
  if (o.champs) w.updateMask = { fieldPaths: o.champs };
  return w;
}

/** Toutes les écritures réussissent ensemble, ou aucune. */
function enregistrer_(ecritures) {
  const rep = UrlFetchApp.fetch(FIRESTORE.replace(/\/documents$/, '/documents:commit'), {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + jetonGoogle_() },
    payload: JSON.stringify({ writes: ecritures }),
    muteHttpExceptions: true,
  });
  if (rep.getResponseCode() !== 200) throw new Error('Firebase refuse l’enregistrement (' + rep.getResponseCode() + ') : ' + rep.getContentText().slice(0, 300));
}

function modifier_(chemin, valeurs) {
  enregistrer_([ecriture_(chemin, valeurs, { champs: Object.keys(valeurs) })]);
}

function listerCollection_(nom) {
  const res = [];
  let suite = '';
  for (let page = 0; page < 20; page++) {
    const rep = UrlFetchApp.fetch(FIRESTORE + '/' + nom + '?pageSize=300' + (suite ? '&pageToken=' + encodeURIComponent(suite) : ''), {
      headers: { Authorization: 'Bearer ' + jetonGoogle_() },
      muteHttpExceptions: true,
    });
    if (rep.getResponseCode() !== 200) throw new Error('Firebase illisible (' + rep.getResponseCode() + ').');
    const json = JSON.parse(rep.getContentText());
    (json.documents || []).forEach((d) => res.push(Object.assign(depuisChamps(d.fields || {}), { id: d.name.split('/').pop() })));
    suite = json.nextPageToken;
    if (!suite) break;
  }
  return res;
}

function lireDocument_(chemin) {
  const rep = UrlFetchApp.fetch(FIRESTORE + '/' + chemin, {
    headers: { Authorization: 'Bearer ' + jetonGoogle_() },
    muteHttpExceptions: true,
  });
  if (rep.getResponseCode() === 404) return null;
  if (rep.getResponseCode() !== 200) throw new Error('Firebase illisible (' + rep.getResponseCode() + ').');
  return depuisChamps(JSON.parse(rep.getContentText()).fields || {});
}

/** Valeurs JavaScript → format de l'API Firestore. */
function enChamps(objet) {
  const valeur = (v) => {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(valeur) } };
    if (typeof v === 'object') return { mapValue: { fields: enChamps(v) } };
    return { stringValue: String(v) };
  };
  const res = {};
  Object.keys(objet).forEach((k) => (res[k] = valeur(objet[k])));
  return res;
}

function depuisChamps(champs) {
  const valeur = (v) => {
    if ('stringValue' in v) return v.stringValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(valeur);
    if ('mapValue' in v) return depuisChamps(v.mapValue.fields || {});
    return null;
  };
  const res = {};
  Object.keys(champs).forEach((k) => (res[k] = valeur(champs[k])));
  return res;
}

function nouvelleCle_() {
  const octets = Utilities.getUuid() + Utilities.getUuid() + Date.now();
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, octets))
    .replace(/=+$/, '')
    .slice(0, 32);
}

function envoyerLien_(membre, cle) {
  const lien = `${ADRESSE_APP}/#cle=${cle}`;
  const texte = [
    membre.prenom ? `Bonjour ${membre.prenom},` : 'Bonjour,',
    '',
    'Votre inscription au pèlerinage Himmelsweg des 7, 8 et 9 mai 2027 est confirmée. Merci !',
    '',
    'Voici votre lien personnel vers l’application du pèlerinage :',
    lien,
    '',
    'Ouvrez-le sur votre téléphone : l’application s’ouvre directement, sans mot de passe.',
    'Ajoutez-la ensuite à votre écran d’accueil : elle fonctionnera même sans réseau pendant la marche.',
    'Vous y trouverez la liste d’affaires, les horaires, le transport et tout ce qu’il faut savoir,',
    'et vous pourrez y corriger vos réponses à l’inscription.',
    '',
    'Ce lien est personnel : merci de ne pas le transmettre.',
    '',
    'À bientôt sur le chemin du Ciel,',
    'Le secrétariat du pèlerinage Himmelsweg',
  ].join('\n');
  const sujet = 'Votre accès à l’application du pèlerinage Himmelsweg' + (membre.prenom ? ` (${membre.prenom})` : '');
  envoyer_(membre.email, sujet, texte, lien, 'Ouvrir mon application');
}

/* ------------------------------------------------------------------ */
/* E-mails                                                             */
/* ------------------------------------------------------------------ */

function envoyerRelance_(ref, dossier) {
  const lien = `${ADRESSE_APP}/inscription/payer?ref=${ref}`;
  const texte = [
    'Bonjour ' + dossier.payeur.prenom + ',',
    '',
    'Votre inscription au pèlerinage Himmelsweg des 7, 8 et 9 mai 2027 (' + (dossier.noms || []).join(', ') + ') est enregistrée, mais le paiement n’a pas encore été reçu.',
    '',
    'Pour la terminer, il suffit de payer en ligne :',
    lien,
    '',
    'Si vous avez déjà réglé autrement (chèque, espèces), ne tenez pas compte de ce message : le secrétariat le validera.',
    'Une question ? Répondez simplement à cet e-mail.',
    '',
    'Le secrétariat du pèlerinage Himmelsweg',
  ].join('\n');
  envoyer_(dossier.payeur.email, 'Votre inscription au pèlerinage Himmelsweg attend son paiement', texte, lien, 'Payer mon inscription');
}

function envoyer_(a, sujet, texte, lien, bouton) {
  const html = texte
    .split('\n')
    .map((l) => (l === lien ? `<p><a href="${lien}" style="display:inline-block;background:#b32d24;color:#fff;padding:12px 20px;border-radius:24px;text-decoration:none;font-weight:bold">${bouton}</a></p>` : l ? `<p>${l}</p>` : ''))
    .join('');
  const options = { name: 'Pèlerinage Himmelsweg', htmlBody: html };
  if (GmailApp.getAliases().indexOf(EXPEDITEUR) !== -1) options.from = EXPEDITEUR;
  GmailApp.sendEmail(a, sujet, texte, options);
}

/* ------------------------------------------------------------------ */
/* 4. Connexion par lien personnel                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Site himmelsweg.fr : lecture et enregistrement sur GitHub (admins)  */
/* ------------------------------------------------------------------ */

/**
 * op 'lire' : tous les textes du site, la liste des photos et le schéma de l'éditeur (.pages.yml).
 * op 'ecrire' : enregistre un texte (chemin, contenu, sha de la version lue : refusé si quelqu'un l'a changé entre-temps).
 * op 'photo' : ajoute une photo (chemin, base64). op 'supprimer' : supprime une page (chemin, sha).
 */
function site_(d) {
  const appelant = qui_(d.idToken);
  if (!appelant.admin) throw refus_('Réservé aux administrateurs.');
  if (!PropertiesService.getScriptProperties().getProperty('GITHUB_CLE')) {
    throw refus_('La clé GitHub n’est pas encore installée dans le script Google (propriété GITHUB_CLE).');
  }
  const qui = appelant.email || 'un admin';
  if (d.op === 'lire') {
    const dossiers = ['site/src/content/pages', 'site/src/content/site', 'site/src/assets/photos'].map((c) => github_('GET', 'contents/' + c + '?ref=' + BRANCHE_SITE));
    const textes = dossiers[0].concat(dossiers[1]).filter((f) => f.type === 'file' && SITE_TEXTES.test(f.path));
    const reps = lireTous_(textes.map((f) => 'contents/' + f.path + '?ref=' + BRANCHE_SITE).concat(['contents/.pages.yml?ref=' + BRANCHE_SITE]));
    const schema = reps.pop();
    return {
      fichiers: reps.map((f) => ({ chemin: f.path, sha: f.sha, contenu: texteBase64_(f.content) })),
      photos: dossiers[2].filter((f) => f.type === 'file').map((f) => f.name),
      schema: texteBase64_(schema.content),
    };
  }
  if (d.op === 'ecrire') {
    if (!SITE_TEXTES.test(d.chemin || '')) throw refus_('Fichier non modifiable depuis l’app.');
    const corps = { message: 'Site : ' + d.chemin.split('/').pop() + ' modifié depuis l’app (' + qui + ')', content: Utilities.base64Encode(String(d.contenu || ''), Utilities.Charset.UTF_8), branch: BRANCHE_SITE };
    if (d.sha) corps.sha = d.sha;
    const r = github_('PUT', 'contents/' + d.chemin, corps);
    return { sha: r.content.sha };
  }
  if (d.op === 'photo') {
    if (!SITE_PHOTOS.test(d.chemin || '')) throw refus_('Nom de photo invalide.');
    if (String(d.base64 || '').length > 14000000) throw refus_('Photo trop lourde (10 Mo au plus).');
    github_('PUT', 'contents/' + d.chemin, { message: 'Site : photo ' + d.chemin.split('/').pop() + ' ajoutée depuis l’app (' + qui + ')', content: String(d.base64), branch: BRANCHE_SITE });
    return { chemin: d.chemin };
  }
  if (d.op === 'supprimer') {
    if (!/^site\/src\/content\/pages\/[a-z0-9-]+\.md$/.test(d.chemin || '')) throw refus_('Seules les pages peuvent être supprimées.');
    github_('DELETE', 'contents/' + d.chemin, { message: 'Site : page ' + d.chemin.split('/').pop() + ' supprimée depuis l’app (' + qui + ')', sha: d.sha, branch: BRANCHE_SITE });
    return { ok: true };
  }
  throw refus_('Demande invalide.');
}

function enteteGithub_() {
  return { Authorization: 'Bearer ' + PropertiesService.getScriptProperties().getProperty('GITHUB_CLE'), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
}

function github_(methode, chemin, corps) {
  const opts = { method: methode.toLowerCase(), headers: enteteGithub_(), muteHttpExceptions: true };
  if (corps) {
    opts.contentType = 'application/json';
    opts.payload = JSON.stringify(corps);
  }
  const rep = UrlFetchApp.fetch('https://api.github.com/repos/' + DEPOT_SITE + '/' + chemin, opts);
  return reponseGithub_(rep);
}

function reponseGithub_(rep) {
  const code = rep.getResponseCode();
  if (code === 409 || code === 422) throw refus_('Ce texte a été modifié ailleurs entre-temps. Rechargez la page du site et refaites la modification.');
  if (code === 401 || code === 403) throw refus_('La clé GitHub est refusée (expirée ou sans le droit « Contents »). Recréez-la et recollez-la dans GITHUB_CLE.');
  if (code >= 300) throw new Error('GitHub ' + code + ' : ' + rep.getContentText().slice(0, 300));
  return JSON.parse(rep.getContentText() || '{}');
}

/** Plusieurs lectures GitHub en parallèle. */
function lireTous_(chemins) {
  const demandes = chemins.map((c) => ({ url: 'https://api.github.com/repos/' + DEPOT_SITE + '/' + c, headers: enteteGithub_(), muteHttpExceptions: true }));
  return UrlFetchApp.fetchAll(demandes).map(reponseGithub_);
}

function texteBase64_(b64) {
  return Utilities.newBlob(Utilities.base64Decode(String(b64 || '').replace(/\s/g, ''))).getDataAsString('UTF-8');
}

function json_(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}

/** Jeton de connexion Firebase (« custom token ») au nom du pèlerin. Valable 1 heure, à usage de connexion. */
function jetonDeConnexion_(uid) {
  const sa = cleFirebase_();
  const maintenant = Math.floor(Date.now() / 1000);
  return jwt_(
    {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
      iat: maintenant,
      exp: maintenant + 3600,
      uid,
    },
    sa.private_key,
  );
}

/** Jeton d'accès du compte de service pour lire et écrire dans la base. */
function jetonGoogle_() {
  const cache = CacheService.getScriptCache();
  const enCache = cache.get('jeton_google_2');
  if (enCache) return enCache;
  const sa = cleFirebase_();
  const maintenant = Math.floor(Date.now() / 1000);
  const assertion = jwt_(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: maintenant,
      exp: maintenant + 3600,
    },
    sa.private_key,
  );
  const rep = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion },
    muteHttpExceptions: true,
  });
  if (rep.getResponseCode() !== 200) throw new Error('Clé Firebase refusée (' + rep.getResponseCode() + ').');
  const jeton = JSON.parse(rep.getContentText()).access_token;
  cache.put('jeton_google_2', jeton, 3000);
  return jeton;
}

function cleFirebase_() {
  const brut = PropertiesService.getScriptProperties().getProperty('FIREBASE_CLE');
  if (!brut) throw new Error('Propriété FIREBASE_CLE absente.');
  return JSON.parse(brut);
}

function jwt_(contenu, clePrivee) {
  const b64 = (o) => Utilities.base64EncodeWebSafe(JSON.stringify(o)).replace(/=+$/, '');
  const entete = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64(contenu);
  const signature = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(entete, clePrivee)).replace(/=+$/, '');
  return entete + '.' + signature;
}

/* ------------------------------------------------------------------ */
/* Règles du questionnaire : COPIE AUTOMATIQUE de app/src/donnees/questionnaire.js */
/* Ne pas modifier ici : modifier l'original puis lancer                */
/* « node google/app/copier-noyau.mjs ».                                */
/* ------------------------------------------------------------------ */

// ---- NOYAU DÉBUT ----
const DEBUT = '2027-05-07';
const AGE_MINIMUM = 15;
// Réponses rangées directement sur la fiche (les autres vont dans « reponses » ou dans les infos protégées).
const CHAMPS_FICHE = ['prenom', 'nom', 'dateNaissance', 'email', 'tel'];

/** Âge au premier jour du pèlerinage. */
function ageAu(dateNaissance) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateNaissance || ''))) return null;
  const [a, m, j] = dateNaissance.split('-').map(Number);
  const [A, M, J] = DEBUT.split('-').map(Number);
  return A - a - (M < m || (M === m && J < j) ? 1 : 0);
}

/** La question s'affiche-t-elle pour cette personne ? */
function estVisible(q, groupe, reponses) {
  if (q.actif === false) return false;
  if (q.groupe && q.groupe !== 'tous' && q.groupe !== groupe) return false;
  const c = q.condition;
  if (!c || !c.type) return true;
  const a = ageAu(reponses && reponses.dateNaissance);
  if (c.type === 'mineur') return a !== null && a < 18;
  if (c.type === 'majeur') return a !== null && a >= 18;
  if (c.type === 'reponse') {
    const r = reponses ? reponses[c.question] : undefined;
    return Array.isArray(r) ? r.indexOf(c.valeur) !== -1 : String(r == null ? '' : r) === String(c.valeur == null ? '' : c.valeur);
  }
  return true;
}

function questionsTriees(questions) {
  return (questions || []).slice().sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || String(a.id).localeCompare(String(b.id)));
}

function estVide(v) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Tarifs proposés à une personne selon son âge. */
function tarifsPour(tarifs, a) {
  return (tarifs || []).filter(
    (t) => t.actif !== false && (a === null || ((t.ageMin == null || a >= t.ageMin) && (t.ageMax == null || a <= t.ageMax))),
  );
}

/** Erreurs d'une personne : { idQuestion: message }. Vide si tout va bien. */
function erreursPersonne(questions, personne, tarifs) {
  const err = {};
  const groupe = personne.groupe;
  const reponses = personne.reponses || {};
  if (groupe !== 'H' && groupe !== 'F') err.groupe = 'Choisissez Homme ou Femme.';
  questionsTriees(questions).forEach((q) => {
    if (q.type === 'info' || !estVisible(q, groupe, reponses)) return;
    const v = reponses[q.id];
    if (q.type === 'case' && v !== true) {
      err[q.id] = 'À cocher pour continuer.';
      return;
    }
    if (q.type === 'signature' && !(v && v.image)) {
      err[q.id] = 'Signature nécessaire.';
      return;
    }
    if (q.obligatoire && estVide(v)) {
      err[q.id] = 'Réponse obligatoire.';
      return;
    }
    if (estVide(v)) return;
    if (q.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) err[q.id] = 'Adresse e-mail incorrecte.';
    if (q.type === 'telephone' && String(v).replace(/[^\d+]/g, '').length < 8) err[q.id] = 'Numéro incomplet.';
    if (q.type === 'nombre' && isNaN(Number(v))) err[q.id] = 'Nombre attendu.';
    if (q.type === 'date' && ageAu(v) === null) err[q.id] = 'Date incorrecte.';
    if (q.type === 'choix' && (q.options || []).indexOf(v) === -1) err[q.id] = 'Choix inconnu.';
    if (q.type === 'oui_non' && v !== 'Oui' && v !== 'Non') err[q.id] = 'Répondez Oui ou Non.';
  });
  const a = ageAu(reponses.dateNaissance);
  if (a !== null && (a < AGE_MINIMUM || a > 110)) {
    err.dateNaissance = a < AGE_MINIMUM ? 'Moins de ' + AGE_MINIMUM + ' ans : merci de contacter le secrétariat avant l’inscription.' : 'Date incorrecte.';
  }
  if (tarifs) {
    const t = (tarifs || []).filter((x) => x.id === personne.tarif && x.actif !== false)[0];
    if (!t) err.tarif = 'Choisissez un tarif.';
    else if (a !== null && tarifsPour([t], a).length === 0) err.tarif = 'Ce tarif ne correspond pas à l’âge indiqué.';
  }
  return err;
}

/** Total du panier, en centimes (le don est en centimes). */
function totalPanier(personnes, tarifs, don) {
  const places = personnes.reduce((s, p) => {
    const t = (tarifs || []).filter((x) => x.id === p.tarif)[0];
    return s + (t ? Number(t.montant) || 0 : 0);
  }, 0);
  return places + Math.max(0, Math.round(Number(don) || 0));
}

/**
 * Range les réponses d'une personne :
 *  - membre : fiche visible par l'équipe (nom, téléphone… et « reponses » pour les autres questions) ;
 *  - prive : informations protégées (santé, urgence, signatures…).
 * Les réponses aux questions cachées (condition non remplie) ne sont pas gardées.
 */
function versFiche(questions, groupe, reponses) {
  const membre = { groupe, reponses: {} };
  const prive = {};
  questionsTriees(questions).forEach((q) => {
    const v = reponses[q.id];
    if (q.type === 'info' || !estVisible(q, groupe, reponses) || estVide(v)) return;
    if (CHAMPS_FICHE.indexOf(q.id) !== -1) membre[q.id] = typeof v === 'string' ? v.trim() : v;
    else if (q.visibilite === 'sensible') prive[q.id] = v;
    else membre.reponses[q.id] = v;
  });
  if (membre.email) membre.email = String(membre.email).toLowerCase();
  membre.volontaireChef = membre.reponses.volontaireChef === 'Oui';
  return { membre, prive };
}
// ---- NOYAU FIN ----
