/**
 * Script Google de l'application app.himmelsweg.fr
 * (projet Apps Script séparé de celui des formulaires du site).
 *
 * Il tourne sur le compte pelerinagehimmelsweg@gmail.com et fait trois choses :
 *  1. toutes les 15 minutes, il récupère les nouveaux inscrits sur HelloAsso
 *     et crée leur fiche dans l'app (base Firebase) ;
 *  2. il envoie à chacun son lien personnel, depuis Gmail, au nom de secretariat@himmelsweg.fr ;
 *  3. quand quelqu'un ouvre son lien, il vérifie la clé et ouvre sa session dans l'app.
 *
 * Réglages : Paramètres du projet → Propriétés du script (jamais dans le code ni dans un chat).
 *   HELLOASSO_CLIENT_ID, HELLOASSO_CLIENT_SECRET : clé API HelloAsso
 *   HELLOASSO_ORGANISATION : association-pour-le-culte-catholique-traditionnel-en-alsace
 *   FORMULAIRE_FEMMES, FORMULAIRE_HOMMES : fin de l'adresse de chaque formulaire d'inscription HelloAsso
 *   FIREBASE_CLE : contenu complet du fichier JSON de la clé du compte de service Firebase
 * Installation pas à pas : google/app/README.md
 */

const PROJET_FIREBASE = 'himmelsweg-cbd26';
const ADRESSE_APP = 'https://app.himmelsweg.fr';
const EXPEDITEUR = 'secretariat@himmelsweg.fr';
const DEBUT_PELERINAGE = '2027-05-07';
const API_HELLOASSO = 'https://api.helloasso.com';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJET_FIREBASE}/databases/(default)/documents`;

/* ------------------------------------------------------------------ */
/* À lancer une fois à la main : vérifie les réglages et programme la  */
/* récupération automatique toutes les 15 minutes.                    */
/* ------------------------------------------------------------------ */

function installer() {
  const manque = reglagesManquants_();
  if (manque.length) throw new Error('Réglages manquants dans les propriétés du script : ' + manque.join(', '));
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'synchroniser')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('synchroniser').timeBased().everyMinutes(15).create();
  jetonGoogle_(); // vérifie la clé Firebase
  jetonHelloAsso_(); // vérifie la clé HelloAsso
  Logger.log('Installation terminée. Les inscrits seront récupérés toutes les 15 minutes.');
  Logger.log('Alias Gmail ' + EXPEDITEUR + (GmailApp.getAliases().indexOf(EXPEDITEUR) === -1 ? ' INTROUVABLE : les e-mails partiront de l’adresse Gmail.' : ' trouvé.'));
}

function reglagesManquants_() {
  const p = PropertiesService.getScriptProperties().getProperties();
  return ['HELLOASSO_CLIENT_ID', 'HELLOASSO_CLIENT_SECRET', 'HELLOASSO_ORGANISATION', 'FIREBASE_CLE']
    .concat(p.FORMULAIRE_FEMMES || p.FORMULAIRE_HOMMES ? [] : ['FORMULAIRE_FEMMES ou FORMULAIRE_HOMMES'])
    .filter((k) => k.indexOf(' ou ') !== -1 || !p[k]);
}

/* ------------------------------------------------------------------ */
/* 1. Récupération des inscrits HelloAsso                              */
/* ------------------------------------------------------------------ */

function synchroniser() {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(1000)) return; // une synchronisation tourne déjà
  try {
    const p = PropertiesService.getScriptProperties();
    const importes = JSON.parse(p.getProperty('IMPORTES') || '[]');
    const deja = new Set(importes);
    let nouveaux = 0;
    [['F', p.getProperty('FORMULAIRE_FEMMES')], ['H', p.getProperty('FORMULAIRE_HOMMES')]].forEach(([groupe, formulaire]) => {
      if (!formulaire) return;
      inscriptionsHelloAsso_(formulaire).forEach((item) => {
        const id = 'ha-' + item.id;
        if (deja.has(id) || item.state !== 'Processed') return;
        try {
          const fiche = ficheDepuisHelloAsso(item, groupe);
          const cle = nouvelleCle_();
          const cree = creerMembre_(id, fiche, cle); // en cas d'erreur ici, on réessaiera dans 15 minutes
          deja.add(id);
          importes.push(id);
          p.setProperty('IMPORTES', JSON.stringify(importes));
          if (cree && fiche.membre.email) {
            nouveaux++;
            try {
              envoyerLien_(fiche.membre, cle);
            } catch (err) {
              console.error('E-mail non envoyé à ' + fiche.membre.email + ' : ' + err.message + ' (lien visible dans l’app, fiche du pèlerin).');
            }
          }
        } catch (err) {
          console.error('Inscription ' + id + ' : ' + err.message);
        }
      });
    });
    if (nouveaux) Logger.log(nouveaux + ' nouvel(le)s inscrit(e)s importé(e)s.');
  } finally {
    verrou.releaseLock();
  }
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

function inscriptionsHelloAsso_(formulaire) {
  const org = PropertiesService.getScriptProperties().getProperty('HELLOASSO_ORGANISATION');
  const items = [];
  let suite = '';
  for (let page = 0; page < 50; page++) {
    const url =
      `${API_HELLOASSO}/v5/organizations/${encodeURIComponent(org)}/forms/Event/${encodeURIComponent(formulaire)}/items` +
      `?withDetails=true&pageSize=100&itemStates=Processed${suite ? '&continuationToken=' + encodeURIComponent(suite) : ''}`;
    const rep = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + jetonHelloAsso_() }, muteHttpExceptions: true });
    if (rep.getResponseCode() !== 200) throw new Error('HelloAsso : formulaire « ' + formulaire + ' » illisible (' + rep.getResponseCode() + ').');
    const json = JSON.parse(rep.getContentText());
    const lot = json.data || [];
    items.push.apply(items, lot);
    suite = json.pagination && json.pagination.continuationToken;
    if (!lot.length || !suite || lot.length < 100) break;
  }
  return items;
}

/**
 * Transforme une inscription HelloAsso en fiche pour l'app.
 * Les questions du formulaire sont reconnues par des mots de leur intitulé
 * (voir google/app/README.md pour les intitulés à utiliser).
 */
function ficheDepuisHelloAsso(item, groupe) {
  const rep = {};
  (item.customFields || []).forEach((c) => (rep[normaliser(c.name)] = String(c.answer == null ? '' : c.answer).trim()));
  // Première réponse dont l'intitulé contient tous les mots (sauf ceux des questions urgence / référent).
  const trouve = (...mots) => {
    const autres = ['urgence', 'referent'].filter((m) => mots.indexOf(m) === -1);
    const k = Object.keys(rep).find((n) => mots.every((m) => n.indexOf(m) !== -1) && autres.every((m) => n.indexOf(m) === -1));
    return k ? rep[k] : '';
  };
  const oui = (v) => /^(oui|yes|true|1|x)$/i.test(v.trim()) || /^j.?accepte/i.test(normaliser(v));
  const personne = item.user || {};
  const payeur = item.payer || {};
  const dateNaissance = enDateIso(trouve('naissance'));
  const mineur = (() => {
    if (!dateNaissance) return false;
    const [a, m, j] = dateNaissance.split('-').map(Number);
    const [A, M, J] = DEBUT_PELERINAGE.split('-').map(Number);
    return A - a - (M < m || (M === m && J < j) ? 1 : 0) < 18;
  })();
  return {
    membre: {
      prenom: (personne.firstName || payeur.firstName || '').trim(),
      nom: (personne.lastName || payeur.lastName || '').trim(),
      groupe,
      email: (trouve('mail') || payeur.email || '').trim().toLowerCase(),
      tel: trouve('telephone', 'portable') || trouve('telephone') || '',
      dateNaissance,
      chapitre: null,
      roles: ['pelerin'],
      volontaireChef: oui(trouve('chef')),
      inscritLe: String((item.order && item.order.date) || new Date().toISOString()).slice(0, 10),
      helloassoId: String(item.id),
    },
    prive: {
      urgenceNom: trouve('urgence', 'nom'),
      urgenceTel: trouve('urgence', 'telephone'),
      sante: trouve('sante', 'information') || trouve('sante', 'signaler') || '',
      regime: (() => {
        const r = trouve('regime');
        return /^(aucun|non|rien|-)?$/i.test(r) ? '' : r;
      })(),
      referentNom: mineur ? trouve('referent', 'nom') : '',
      referentTel: mineur ? trouve('referent', 'telephone') : '',
      consentementSante: oui(trouve('consent')) || oui(trouve('accepte', 'sante')),
    },
  };
}

function normaliser(texte) {
  return String(texte || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** « 15/09/2010 », « 2010-09-15 » ou « 2010-09-15T00:00:00 » → « 2010-09-15 ». */
function enDateIso(v) {
  const s = String(v || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

/* ------------------------------------------------------------------ */
/* 2. Base Firebase (Firestore) et e-mail du lien personnel           */
/* ------------------------------------------------------------------ */

/** Crée la fiche, ses infos protégées et son lien, en une seule opération. Renvoie false si elle existait. */
function creerMembre_(id, fiche, cle) {
  const doc = (chemin) => `projects/${PROJET_FIREBASE}/databases/(default)/documents/${chemin}`;
  const ecritures = [
    { update: { name: doc('membres/' + id), fields: enChamps(fiche.membre) }, currentDocument: { exists: false } },
    { update: { name: doc(`membres/${id}/prive/fiche`), fields: enChamps(fiche.prive) } },
    { update: { name: doc('liens/' + cle), fields: enChamps({ membreId: id, cree: new Date() }) } },
    { update: { name: doc(`membres/${id}/admin/lien`), fields: enChamps({ cle }) } },
  ];
  const rep = UrlFetchApp.fetch(FIRESTORE.replace(/\/documents$/, '/documents:commit'), {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + jetonGoogle_() },
    payload: JSON.stringify({ writes: ecritures }),
    muteHttpExceptions: true,
  });
  const code = rep.getResponseCode();
  if (code === 200) return true;
  if (code === 409 || /FAILED_PRECONDITION|ALREADY_EXISTS/.test(rep.getContentText())) return false;
  throw new Error('Firebase refuse la création de ' + id + ' (' + code + ') : ' + rep.getContentText().slice(0, 300));
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
  const bonjour = membre.prenom ? `Bonjour ${membre.prenom},` : 'Bonjour,';
  const texte = [
    bonjour,
    '',
    'Merci pour votre inscription au pèlerinage Himmelsweg des 7, 8 et 9 mai 2027.',
    '',
    'Voici votre lien personnel vers l’application du pèlerinage :',
    lien,
    '',
    'Ouvrez-le sur votre téléphone : l’application s’ouvre directement, sans mot de passe.',
    'Ajoutez-la ensuite à votre écran d’accueil : elle fonctionnera même sans réseau pendant la marche.',
    'Vous y trouverez la liste d’affaires, les horaires, le transport et tout ce qu’il faut savoir.',
    '',
    'Ce lien est personnel : merci de ne pas le transmettre.',
    '',
    'À bientôt sur le chemin du Ciel,',
    'Le secrétariat du pèlerinage Himmelsweg',
  ].join('\n');
  const html = texte
    .split('\n')
    .map((l) => (l === lien ? `<p><a href="${lien}" style="display:inline-block;background:#b32d24;color:#fff;padding:12px 20px;border-radius:24px;text-decoration:none;font-weight:bold">Ouvrir mon application</a></p>` : l ? `<p>${l}</p>` : ''))
    .join('');
  const options = { name: 'Pèlerinage Himmelsweg', htmlBody: html };
  if (GmailApp.getAliases().indexOf(EXPEDITEUR) !== -1) options.from = EXPEDITEUR;
  GmailApp.sendEmail(membre.email, 'Votre accès à l’application du pèlerinage Himmelsweg', texte, options);
}

/* ------------------------------------------------------------------ */
/* 3. Connexion par lien personnel (appelé par l'app)                 */
/* ------------------------------------------------------------------ */

function doPost(e) {
  try {
    const demande = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (demande.action !== 'connexion' || !/^[A-Za-z0-9_-]{16,64}$/.test(demande.cle || '')) return json_({ erreur: 'Demande invalide.' });
    const lien = lireDocument_('liens/' + demande.cle);
    if (!lien || !lien.membreId) return json_({ erreur: 'Ce lien n’est plus valable. Demandez-en un nouveau au secrétariat.' });
    return json_({ jeton: jetonDeConnexion_(lien.membreId) });
  } catch (err) {
    console.error(err);
    return json_({ erreur: 'Connexion impossible pour le moment. Réessayez dans quelques minutes.' });
  }
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
  const enCache = cache.get('jeton_google');
  if (enCache) return enCache;
  const sa = cleFirebase_();
  const maintenant = Math.floor(Date.now() / 1000);
  const assertion = jwt_(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
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
  cache.put('jeton_google', jeton, 3000);
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
