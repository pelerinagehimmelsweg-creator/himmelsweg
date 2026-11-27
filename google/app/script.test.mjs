// Tests du script Google, sans Google : on simule Apps Script, la base Firestore et HelloAsso.
// Lancer depuis la racine du dépôt : node --test google/app/script.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { CONFIG_DEPART, QUESTIONS_DEPART } from '../../app/src/donnees/questionnaire.js';
import { noyau } from './copier-noyau.mjs';

const CODE = readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const CLE_SA = {
  client_email: 'firebase-adminsdk-test@himmelsweg-cbd26.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
};
const BASE = 'https://firestore.googleapis.com/v1/projects/himmelsweg-cbd26/databases/(default)/documents';

function charger({ proprietes = {}, base = {}, paye = () => false, maintenant, sessions = {}, depot = {} } = {}) {
  const github = new Map(Object.entries(depot).map(([k, v]) => [k, { contenu: v, sha: 'sha-' + k.length }]));
  const commits = [];
  const envoisFcm = [];
  const appels = [];
  const emails = [];
  const intentions = [];
  const docs = new Map();
  const props = {
    FIREBASE_CLE: JSON.stringify(CLE_SA),
    HELLOASSO_CLIENT_ID: 'id',
    HELLOASSO_CLIENT_SECRET: 'secret',
    HELLOASSO_ORGANISATION: 'asso',
    ...proprietes,
  };
  const cache = {};
  const b64ws = (x) => Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  const rep = (code, corps) => ({ code, corps: typeof corps === 'string' ? corps : JSON.stringify(corps) });

  const repondre = (url, opts) => {
    const mg = /^https:\/\/api\.github\.com\/repos\/pelerinagehimmelsweg-creator\/himmelsweg\/contents\/([^?]+)/.exec(url);
    if (mg) {
      if (opts.headers?.Authorization !== 'Bearer cle-gh') return rep(401, 'Bad credentials');
      const chemin = mg[1];
      const methode = opts.method ?? 'get';
      if (methode === 'get') {
        if (github.has(chemin)) {
          const f = github.get(chemin);
          return rep(200, { type: 'file', path: chemin, name: chemin.split('/').pop(), sha: f.sha, content: Buffer.from(f.contenu).toString('base64').replace(/(.{60})/g, '$1\n') });
        }
        const liste = [...github.keys()].filter((k) => k.startsWith(chemin + '/') && !k.slice(chemin.length + 1).includes('/'));
        return rep(200, liste.map((k) => ({ type: 'file', path: k, name: k.split('/').pop(), sha: github.get(k).sha })));
      }
      const corps = JSON.parse(opts.payload);
      const existe = github.get(chemin);
      if (existe && corps.sha !== existe.sha) return rep(409, 'conflict');
      if (!existe && corps.sha) return rep(404, 'Not Found');
      commits.push({ methode, chemin, message: corps.message, branche: corps.branch });
      if (methode === 'delete') {
        github.delete(chemin);
        return rep(200, {});
      }
      const sha = 'sha-' + commits.length;
      github.set(chemin, { contenu: Buffer.from(corps.content, 'base64').toString('utf8'), sha });
      return rep(200, { content: { sha } });
    }
    if (url.endsWith('oauth2.googleapis.com/token')) return rep(200, { access_token: 'g' });
    if (url.endsWith('api.helloasso.com/oauth2/token')) return rep(200, { access_token: 'h', expires_in: 1800 });
    if (url.endsWith('/checkout-intents') && opts.method === 'post') {
      const p = JSON.parse(opts.payload).payer;
      if (p && (p.firstName === p.lastName || /^test$/i.test(p.lastName))) return rep(400, { errors: [{ code: 'ArgumentInvalid', message: 'Le nom du payeur est invalide.' }] });
      const id = 1000 + intentions.length;
      intentions.push({ id, corps: JSON.parse(opts.payload) });
      return rep(200, { id, redirectUrl: `https://www.helloasso.com/paiement/${id}` });
    }
    const mi = /\/checkout-intents\/(\d+)$/.exec(url);
    if (mi) return rep(200, paye(Number(mi[1])) ? { id: Number(mi[1]), order: { id: 55, payments: [{ state: 'Authorized' }] } } : { id: Number(mi[1]) });
    if (url.includes('accounts:lookup')) {
      const u = sessions[JSON.parse(opts.payload).idToken];
      return u ? rep(200, { users: [u] }) : rep(400, { error: { message: 'INVALID_ID_TOKEN' } });
    }
    if (url.includes('fcm.googleapis.com')) {
      const { message } = JSON.parse(opts.payload);
      if (message.token === 'perime') return rep(404, { error: { status: 'NOT_FOUND', details: 'UNREGISTERED' } });
      envoisFcm.push(message);
      return rep(200, { name: 'ok' });
    }
    if (url.endsWith(':runQuery')) {
      const { collectionId } = JSON.parse(opts.payload).structuredQuery.from[0];
      return rep(
        200,
        [...docs.keys()]
          .filter((k) => k.split('/').at(-2) === collectionId)
          .map((k) => ({ document: { name: `projects/x/databases/(default)/documents/${k}`, fields: docs.get(k) } })),
      );
    }
    if (url.endsWith(':commit')) {
      let { writes } = JSON.parse(opts.payload);
      writes.filter((w) => w.delete).forEach((w) => docs.delete(w.delete.split('/documents/')[1]));
      writes = writes.filter((w) => !w.delete);
      const chemins = writes.map((w) => w.update.name.split('/documents/')[1]);
      if (writes.some((w, i) => w.currentDocument?.exists === false && docs.has(chemins[i]))) return rep(409, 'ALREADY_EXISTS');
      writes.forEach((w, i) => {
        const avant = docs.get(chemins[i]) ?? {};
        if (w.updateMask) {
          const n = { ...avant };
          w.updateMask.fieldPaths.forEach((k) => (n[k] = w.update.fields[k]));
          docs.set(chemins[i], n);
        } else docs.set(chemins[i], w.update.fields);
      });
      return rep(200, {});
    }
    if (url.startsWith(BASE + '/')) {
      const chemin = decodeURIComponent(url.slice(BASE.length + 1).split('?')[0]);
      if (url.includes('?pageSize')) {
        const documents = [...docs.keys()]
          .filter((k) => k.startsWith(chemin + '/') && !k.slice(chemin.length + 1).includes('/'))
          .map((k) => ({ name: `projects/x/databases/(default)/documents/${k}`, fields: docs.get(k) }));
        return rep(200, { documents });
      }
      return docs.has(chemin) ? rep(200, { fields: docs.get(chemin) }) : rep(404, '');
    }
    return rep(404, '');
  };

  const ctx = {
    console: { error: () => {}, log: console.log },
    Logger: { log: () => {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => props[k] ?? null,
        setProperty: (k, v) => (props[k] = v),
        getProperties: () => ({ ...props }),
      }),
    },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] ?? null, put: (k, v) => (cache[k] = v) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    Utilities: {
      base64EncodeWebSafe: (x) => b64ws(typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(x)),
      computeRsaSha256Signature: (texte, cle) => [...crypto.sign('sha256', Buffer.from(texte), cle)],
      computeDigest: (_a, texte) => [...crypto.createHash('sha256').update(texte).digest()],
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      getUuid: () => crypto.randomUUID(),
      Charset: { UTF_8: 'UTF-8' },
      base64Encode: (x) => Buffer.from(x, 'utf8').toString('base64'),
      base64Decode: (x) => [...Buffer.from(x, 'base64')],
      newBlob: (octets) => ({ getDataAsString: () => Buffer.from(octets).toString('utf8') }),
    },
    UrlFetchApp: {
      fetch: (url, opts = {}) => {
        appels.push({ url, opts });
        const r = repondre(url, opts);
        return { getResponseCode: () => r.code, getContentText: () => r.corps };
      },
      fetchAll: (demandes) => demandes.map(({ url, ...opts }) => ctx.UrlFetchApp.fetch(url, opts)),
    },
    GmailApp: { getAliases: () => ['secretariat@himmelsweg.fr'], sendEmail: (...a) => emails.push(a) },
    ContentService: {
      createTextOutput: (t) => ({ texte: t, setMimeType() { return this; } }),
      MimeType: { JSON: 'json' },
    },
  };
  if (maintenant) {
    const VraiDate = Date;
    ctx.Date = class extends VraiDate {
      constructor(...a) {
        super(...(a.length ? a : [maintenant()]));
      }
      static now() {
        return maintenant();
      }
    };
  }
  vm.createContext(ctx);
  vm.runInContext(CODE + '\n;this.__ = { enChamps, depuisChamps, doPost, suivre };', ctx);
  const s = ctx.__;
  const ecrire = (chemin, valeurs) => docs.set(chemin, s.enChamps(valeurs));
  for (const [k, v] of Object.entries(base)) ecrire(k, v);
  const lire = (chemin) => (docs.has(chemin) ? JSON.parse(JSON.stringify(s.depuisChamps(docs.get(chemin)))) : null);
  const appeler = (demande) => JSON.parse(s.doPost({ postData: { contents: JSON.stringify(demande) } }).texte);
  return { ...s, appels, emails, intentions, envoisFcm, props, docs, ecrire, lire, appeler, github, commits };
}

/** Base avec le questionnaire et les tarifs de départ. */
const BASE_DEPART = {
  'config/inscription': CONFIG_DEPART,
  ...Object.fromEntries(QUESTIONS_DEPART.map(({ id, ...q }) => [`questions/${id}`, q])),
};

const ADULTE = {
  groupe: 'H',
  tarif: 'adulte',
  reponses: {
    prenom: 'Paul',
    nom: 'Ott',
    dateNaissance: '1980-03-02',
    email: '',
    tel: '06 15 25 35 45',
    urgenceNom: 'Anne Ott',
    urgenceTel: '07 25 11 22 33',
    sante: 'Genou fragile',
    regime: 'Sans gluten',
    volontaireChef: 'Oui',
    chorale: 'Oui',
    aideLogistique: 'Non',
    consentementSante: true,
  },
};
const MINEURE = {
  groupe: 'F',
  tarif: 'jeune',
  reponses: {
    prenom: 'Françoise',
    nom: 'Ott',
    dateNaissance: '2010-09-15',
    email: 'Francoise@Exemple.fr',
    tel: '06 99 88 77 66',
    urgenceNom: 'Paul Ott',
    urgenceTel: '07 25 11 22 33',
    regime: 'Aucun',
    referentNom: 'Anne Ott',
    referentTel: '06 11 22 33 44',
    autorisationParentale: { image: 'data:image/png;base64,AAAA', signataire: 'Paul Ott', le: '2027-01-15' },
    volontaireChef: 'Non',
    chorale: 'Non',
    aideLogistique: 'Oui', // question réservée aux hommes : ne doit pas être gardée
    consentementSante: true,
  },
};
const PAYEUR = { prenom: 'Paul', nom: 'Ott', email: 'Paul@Exemple.fr' };

test('le noyau du questionnaire est le même dans l’app et dans le script', () => {
  const source = readFileSync(new URL('../../app/src/donnees/questionnaire.js', import.meta.url), 'utf8');
  assert.equal(noyau(CODE), noyau(source), 'Lancer : node google/app/copier-noyau.mjs');
});

test('une inscription crée les fiches et prépare le paiement HelloAsso au bon prix', () => {
  const s = charger({ base: BASE_DEPART });
  const r = s.appeler({ action: 'inscription', personnes: [ADULTE, MINEURE], payeur: PAYEUR, don: 1000, reglement: true, montant: 1 });
  assert.match(r.redirectUrl, /helloasso\.com\/paiement\/1000/);

  const [{ corps }] = s.intentions;
  assert.equal(corps.totalAmount, 5500 + 3500 + 1000); // le « montant » envoyé par l'app est ignoré
  assert.equal(corps.initialAmount, corps.totalAmount);
  assert.equal(corps.containsDonation, true);
  assert.deepEqual(corps.payer, { firstName: 'Paul', lastName: 'Ott', email: 'paul@exemple.fr' });
  assert.equal(corps.returnUrl, `https://app.himmelsweg.fr/inscription/merci?ref=${r.ref}`);

  const dossier = s.lire(`dossiers/${r.ref}`);
  assert.equal(dossier.statut, 'en_attente');
  assert.equal(dossier.montant, 10000);
  assert.equal(dossier.checkoutId, '1000');
  assert.deepEqual(dossier.noms, ['Paul Ott', 'Françoise Ott']);

  const [idPaul, idFrancoise] = dossier.membres;
  const paul = s.lire(`membres/${idPaul}`);
  assert.equal(paul.email, 'paul@exemple.fr'); // vide : celle du payeur
  assert.equal(paul.statut, 'en_attente');
  assert.equal(paul.volontaireChef, true);
  assert.deepEqual(paul.reponses, { volontaireChef: 'Oui', aideLogistique: 'Non', chorale: 'Oui' });
  assert.deepEqual(s.lire(`membres/${idPaul}/prive/fiche`), {
    urgenceNom: 'Anne Ott',
    urgenceTel: '07 25 11 22 33',
    sante: 'Genou fragile',
    regime: 'Sans gluten',
    consentementSante: true,
  });
  const francoise = s.lire(`membres/${idFrancoise}`);
  assert.equal(francoise.email, 'francoise@exemple.fr');
  assert.deepEqual(francoise.reponses, { volontaireChef: 'Non', chorale: 'Non' }); // pas la question des hommes
  const priveF = s.lire(`membres/${idFrancoise}/prive/fiche`);
  assert.equal(priveF.referentNom, 'Anne Ott');
  assert.equal(priveF.autorisationParentale.signataire, 'Paul Ott');
  assert.ok(s.lire(`membres/${idFrancoise}/admin/lien`).cle);
  assert.equal(s.emails.length, 0); // pas de lien avant le paiement
});

test('le serveur refuse les réponses incomplètes et les tarifs qui ne vont pas avec l’âge', () => {
  const s = charger({ base: BASE_DEPART });
  const sansSignature = structuredClone(MINEURE);
  delete sansSignature.reponses.autorisationParentale;
  const r1 = s.appeler({ action: 'inscription', personnes: [sansSignature], payeur: PAYEUR, reglement: true });
  assert.ok(r1.erreur);
  assert.equal(r1.details[0].autorisationParentale, 'Signature nécessaire.');

  const triche = structuredClone(ADULTE);
  triche.tarif = 'jeune';
  const r2 = s.appeler({ action: 'inscription', personnes: [triche], payeur: PAYEUR, reglement: true });
  assert.ok(r2.details[0].tarif);

  const r3 = s.appeler({ action: 'inscription', personnes: [ADULTE], payeur: PAYEUR, reglement: false });
  assert.match(r3.erreur, /règlement/);
  assert.equal(s.intentions.length, 0);
  assert.equal([...s.docs.keys()].filter((k) => k.startsWith('membres/')).length, 0);
});

test('inscriptions fermées par les admins : refus', () => {
  const s = charger({ base: { ...BASE_DEPART, 'config/inscription': { ...CONFIG_DEPART, ouverte: false } } });
  assert.match(s.appeler({ action: 'inscription', personnes: [ADULTE], payeur: PAYEUR, reglement: true }).erreur, /fermées/);
});

test('paiement reçu : fiches inscrites et un lien par personne, une seule fois', () => {
  let paye = false;
  const s = charger({ base: BASE_DEPART, paye: () => paye });
  const { ref } = s.appeler({ action: 'inscription', personnes: [ADULTE, MINEURE], payeur: PAYEUR, reglement: true });
  assert.equal(s.appeler({ action: 'verifier', ref }).statut, 'en_attente');
  paye = true;
  const v = s.appeler({ action: 'verifier', ref });
  assert.equal(v.statut, 'paye');
  const dossier = s.lire(`dossiers/${ref}`);
  assert.equal(dossier.liensEnvoyes, true);
  dossier.membres.forEach((id) => assert.equal(s.lire(`membres/${id}`).statut, 'inscrit'));
  assert.deepEqual(
    s.emails.map((e) => e[0]),
    ['paul@exemple.fr', 'francoise@exemple.fr'],
  );
  const [, sujet, texte, options] = s.emails[1];
  assert.match(sujet, /Françoise/);
  assert.match(texte, /https:\/\/app\.himmelsweg\.fr\/#cle=[A-Za-z0-9_-]{32}/);
  assert.equal(options.from, 'secretariat@himmelsweg.fr');
  s.suivre();
  s.appeler({ action: 'verifier', ref });
  assert.equal(s.emails.length, 2);
});

test('tarif à 0 € : inscription confirmée tout de suite, sans HelloAsso', () => {
  const s = charger({ base: BASE_DEPART });
  const pretre = { ...structuredClone(ADULTE), tarif: 'religieux' };
  const r = s.appeler({ action: 'inscription', personnes: [pretre], payeur: PAYEUR, reglement: true });
  assert.equal(r.gratuit, true);
  assert.equal(s.intentions.length, 0);
  assert.equal(s.lire(`dossiers/${r.ref}`).statut, 'gratuit');
  assert.equal(s.emails.length, 1);
});

test('relances après 3 puis 10 jours, puis plus rien', () => {
  let t = Date.parse('2027-01-01T10:00:00Z');
  const s = charger({ base: BASE_DEPART, maintenant: () => t });
  const { ref } = s.appeler({ action: 'inscription', personnes: [ADULTE], payeur: PAYEUR, reglement: true });
  s.suivre();
  assert.equal(s.emails.length, 0);
  t += 3.1 * 86400000;
  s.suivre();
  s.suivre();
  assert.equal(s.emails.length, 1);
  assert.match(s.emails[0][2], new RegExp(`/inscription/payer\\?ref=${ref}`));
  t += 7 * 86400000;
  s.suivre();
  t += 30 * 86400000;
  s.suivre();
  assert.equal(s.emails.length, 2);
});

test('paiement validé à la main par un admin : le suivi envoie les liens', () => {
  const s = charger({ base: BASE_DEPART });
  const { ref } = s.appeler({ action: 'inscription', personnes: [ADULTE], payeur: PAYEUR, reglement: true });
  const d = s.lire(`dossiers/${ref}`);
  s.ecrire(`dossiers/${ref}`, { ...d, statut: 'valide_main', mode: 'chèque' });
  s.suivre();
  assert.equal(s.emails.length, 1);
  assert.equal(s.lire(`membres/${d.membres[0]}`).statut, 'inscrit');
});

test('payer à nouveau crée un nouveau paiement et garde la trace de l’ancien', () => {
  const s = charger({ base: BASE_DEPART });
  const { ref } = s.appeler({ action: 'inscription', personnes: [ADULTE], payeur: PAYEUR, reglement: true });
  const r = s.appeler({ action: 'payer', ref });
  assert.match(r.redirectUrl, /paiement\/1001/);
  assert.deepEqual(s.lire(`dossiers/${ref}`).paiements, ['1000']);
  assert.ok(s.appeler({ action: 'payer', ref: 'inconnue_1234567890' }).erreur);
});

test('un robot qui remplit la case piège ne crée rien', () => {
  const s = charger({ base: BASE_DEPART });
  s.appeler({ action: 'inscription', personnes: [ADULTE], payeur: PAYEUR, reglement: true, piege: 'x' });
  assert.equal(s.docs.size, Object.keys(BASE_DEPART).length);
});

test('les valeurs passent sans perte vers la base et retour', () => {
  const { enChamps, depuisChamps } = charger();
  const o = { a: 'x', b: true, c: 3, d: null, e: ['pelerin', 'chef'], f: { g: 1.5 } };
  assert.deepEqual(JSON.parse(JSON.stringify(depuisChamps(enChamps(o)))), o);
});

test('connexion : une clé valable donne un jeton Firebase correctement signé', () => {
  const s = charger({ base: { 'liens/CleValable_1234567890': { membreId: 'i-987654' } } });
  const ok = s.appeler({ action: 'connexion', cle: 'CleValable_1234567890' });
  const [h, c, sig] = ok.jeton.split('.');
  assert.ok(crypto.verify('sha256', Buffer.from(h + '.' + c), publicKey, Buffer.from(sig, 'base64url')));
  const contenu = JSON.parse(Buffer.from(c, 'base64url'));
  assert.equal(contenu.uid, 'i-987654');
  assert.equal(contenu.iss, CLE_SA.client_email);
  assert.equal(contenu.aud, 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit');
  assert.ok(contenu.exp - contenu.iat <= 3600);

  const refus = s.appeler({ action: 'connexion', cle: 'CleInconnue_123456789' });
  assert.ok(!refus.jeton && refus.erreur);
  assert.ok(!s.appeler({ action: 'connexion', cle: '../admins/x' }).jeton);
});

const EQUIPE = {
  'admins/directrice@gmail.com': {},
  'membres/logi': { prenom: 'Damien', roles: ['pelerin', 'logistique'], chapitre: 'A', statut: 'inscrit' },
  'membres/secu': { prenom: 'Charles', nom: 'Klein', roles: ['pelerin', 'securite'], chapitre: 'A', statut: 'inscrit' },
  'membres/pel1': { prenom: 'Paul', roles: ['pelerin'], chapitre: 'A', statut: 'inscrit', reponses: { chorale: 'Oui' } },
  'membres/pel2': { prenom: 'Anne', roles: ['pelerin'], chapitre: 'B', statut: 'inscrit' },
  'membres/attente': { prenom: 'Zoé', roles: ['pelerin'], chapitre: 'B', statut: 'en_attente' },
  'membres/pel1/prive/fiche': { regime: 'Végétarien', sante: 'secret' },
  'membres/pel2/prive/fiche': { regime: 'Aucun' },
  'membres/secu/prive/fiche': { regime: 'Aucun' },
  'membres/attente/prive/fiche': { regime: 'Sans gluten' },
  'jetons/logi': { token: 'tok-logi' },
  'jetons/pel1': { token: 'tok-pel1' },
  'jetons/pel2': { token: 'perime' },
  'jetons/secu': { token: 'tok-secu' },
  'alertes/al1': { auteur: 'secu', nom: 'Charles Klein', chapitre: 'Saint-Joseph', message: 'Cheville tordue', position: { lat: 48.2, lng: 7.4 } },
};
const SESSIONS = {
  'jeton-admin': { localId: 'google-uid', email: 'Directrice@gmail.com', emailVerified: true },
  'jeton-secu': { localId: 'secu' },
  'jeton-pel1': { localId: 'pel1' },
};

test('alerte accident : seule la logistique est prévenue, par celui qui l’a lancée', () => {
  const s = charger({ base: EQUIPE, sessions: SESSIONS });
  const r = s.appeler({ action: 'notifier', idToken: 'jeton-secu', cible: 'alerte', valeur: 'al1' });
  assert.equal(r.envoyes, 1);
  assert.deepEqual(s.envoisFcm.map((m) => m.token), ['tok-logi']);
  assert.match(s.envoisFcm[0].webpush.notification.body, /Charles Klein.*Cheville tordue.*maps\.google\.com\/\?q=48\.2,7\.4/);
  assert.ok(s.appeler({ action: 'notifier', idToken: 'jeton-pel1', cible: 'alerte', valeur: 'al1' }).erreur);
  assert.ok(s.appeler({ action: 'notifier', idToken: 'faux', cible: 'alerte', valeur: 'al1' }).erreur);
});

test('notifications : réservées aux admins, ciblées, jetons périmés effacés', () => {
  const s = charger({ base: EQUIPE, sessions: SESSIONS });
  assert.match(s.appeler({ action: 'notifier', idToken: 'jeton-pel1', cible: 'tous', titre: 'x', texte: 'y' }).erreur, /administrateurs/);
  const tous = s.appeler({ action: 'notifier', idToken: 'jeton-admin', cible: 'tous', titre: 'Départ', texte: 'Rendez-vous à 8 h' });
  assert.equal(tous.destinataires, 4); // pas l'inscription en attente
  assert.equal(tous.envoyes, 3);
  assert.equal(s.lire('jetons/pel2'), null);
  s.envoisFcm.length = 0;
  s.appeler({ action: 'notifier', idToken: 'jeton-admin', cible: 'chapitre', valeur: 'A', titre: 'Chapitre', texte: 'Messe à 7 h' });
  assert.deepEqual(s.envoisFcm.map((m) => m.token).sort(), ['tok-logi', 'tok-pel1', 'tok-secu']);
  s.envoisFcm.length = 0;
  s.appeler({ action: 'notifier', idToken: 'jeton-admin', cible: 'role', valeur: 'securite', titre: 'Sécurité', texte: 'Point à 21 h' });
  assert.deepEqual(s.envoisFcm.map((m) => m.token), ['tok-secu']);
  s.envoisFcm.length = 0;
  s.appeler({ action: 'notifier', idToken: 'jeton-admin', cible: 'role', valeur: 'chorale', titre: 'Chorale', texte: 'Répétition à 18 h' });
  assert.deepEqual(s.envoisFcm.map((m) => m.token), ['tok-pel1']);
});

test('équipe repas : nombre par régime des inscrits confirmés, sans aucun nom', () => {
  const s = charger({ base: EQUIPE });
  s.suivre();
  const stats = s.lire('stats/repas');
  assert.equal(stats.total, 4);
  assert.deepEqual(stats.parRegime, { Végétarien: 1, Aucun: 2, 'Non précisé': 1 });
  assert.ok(!JSON.stringify(stats).includes('Paul'));
});

const DEPOT = {
  '.pages.yml': 'content:\n  - name: pages\n',
  'site/src/content/pages/programme.md': '---\ntitle: Programme\n---\nTrois jours à pied. Été 2027.\n',
  'site/src/content/site/menu.yml': 'type: menu\nliens: []\n',
  'site/src/assets/photos/vignes.jpg': 'JPEG',
  'site/src/pages/index.astro': 'code',
};

test('site : seuls les admins lisent et modifient les textes, sans écraser une version plus récente', () => {
  const s = charger({ base: EQUIPE, sessions: SESSIONS, depot: DEPOT, proprietes: { GITHUB_CLE: 'cle-gh' } });
  assert.match(s.appeler({ action: 'site', op: 'lire', idToken: 'jeton-pel1' }).erreur, /administrateurs/);
  const lu = s.appeler({ action: 'site', op: 'lire', idToken: 'jeton-admin' });
  assert.deepEqual(lu.fichiers.map((f) => f.chemin).sort(), ['site/src/content/pages/programme.md', 'site/src/content/site/menu.yml']);
  assert.equal(lu.fichiers.find((f) => f.chemin.endsWith('programme.md')).contenu, DEPOT['site/src/content/pages/programme.md']);
  assert.deepEqual(lu.photos, ['vignes.jpg']);
  assert.match(lu.schema, /content:/);

  const prog = lu.fichiers.find((f) => f.chemin.endsWith('programme.md'));
  const r = s.appeler({ action: 'site', op: 'ecrire', idToken: 'jeton-admin', chemin: prog.chemin, sha: prog.sha, contenu: '---\ntitle: Programme\n---\nÉtapes à venir.\n' });
  assert.ok(r.sha);
  assert.equal(s.github.get(prog.chemin).contenu, '---\ntitle: Programme\n---\nÉtapes à venir.\n');
  assert.equal(s.commits[0].branche, 'main');
  assert.match(s.commits[0].message, /programme\.md.*directrice@gmail\.com/);
  // Deuxième enregistrement avec l'ancienne version : refusé.
  assert.match(s.appeler({ action: 'site', op: 'ecrire', idToken: 'jeton-admin', chemin: prog.chemin, sha: prog.sha, contenu: 'x' }).erreur, /modifié ailleurs/);
  // Pas de fichier de code du site, pas de chemin détourné.
  assert.ok(s.appeler({ action: 'site', op: 'ecrire', idToken: 'jeton-admin', chemin: 'site/src/pages/index.astro', contenu: 'x' }).erreur);
  assert.ok(s.appeler({ action: 'site', op: 'ecrire', idToken: 'jeton-admin', chemin: 'site/src/content/pages/../../pages/a.md', contenu: 'x' }).erreur);
  // Photo et nouvelle page, puis suppression de la page.
  s.appeler({ action: 'site', op: 'photo', idToken: 'jeton-admin', chemin: 'site/src/assets/photos/messe-2027.jpg', base64: Buffer.from('IMG').toString('base64') });
  assert.equal(s.github.get('site/src/assets/photos/messe-2027.jpg').contenu, 'IMG');
  const nouvelle = s.appeler({ action: 'site', op: 'ecrire', idToken: 'jeton-admin', chemin: 'site/src/content/pages/chorale.md', contenu: '---\ntitle: Chorale\n---\n' });
  s.appeler({ action: 'site', op: 'supprimer', idToken: 'jeton-admin', chemin: 'site/src/content/pages/chorale.md', sha: nouvelle.sha });
  assert.ok(!s.github.has('site/src/content/pages/chorale.md'));
  assert.ok(s.appeler({ action: 'site', op: 'supprimer', idToken: 'jeton-admin', chemin: 'site/src/content/site/menu.yml', sha: 'x' }).erreur);
});

test('site : message clair si la clé GitHub manque ou est refusée', () => {
  const sans = charger({ base: EQUIPE, sessions: SESSIONS, depot: DEPOT });
  assert.match(sans.appeler({ action: 'site', op: 'lire', idToken: 'jeton-admin' }).erreur, /GITHUB_CLE/);
  const fausse = charger({ base: EQUIPE, sessions: SESSIONS, depot: DEPOT, proprietes: { GITHUB_CLE: 'perimee' } });
  assert.match(fausse.appeler({ action: 'site', op: 'lire', idToken: 'jeton-admin' }).erreur, /clé GitHub est refusée/);
});

test('HelloAsso refuse le nom du payeur (« test test ») : le paiement se prépare quand même, sans payeur', () => {
  const s = charger({ base: BASE_DEPART });
  const r = s.appeler({ action: 'inscription', personnes: [ADULTE], payeur: { prenom: 'Test', nom: 'test', email: 'test@exemple.fr' }, don: 0, reglement: true });
  assert.ok(r.redirectUrl, JSON.stringify(r));
  assert.equal(s.intentions.length, 1);
  assert.equal(s.intentions[0].corps.payer, undefined);
});
