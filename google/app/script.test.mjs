// Tests du script Google, sans Google : on simule les services Apps Script.
// Lancer depuis la racine du dépôt : node --test google/app/
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const CLE_SA = {
  client_email: 'firebase-adminsdk-test@himmelsweg-cbd26.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
};

function charger({ proprietes = {}, reponses = () => ({ code: 200, corps: '{}' }) } = {}) {
  const appels = [];
  const emails = [];
  const props = { FIREBASE_CLE: JSON.stringify(CLE_SA), ...proprietes };
  const cache = {};
  const b64ws = (x) => Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  const ctx = {
    console,
    Logger: { log: () => {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => props[k] ?? null,
        setProperty: (k, v) => (props[k] = v),
        getProperties: () => ({ ...props }),
      }),
    },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] ?? null, put: (k, v) => (cache[k] = v) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: {
      base64EncodeWebSafe: (x) => b64ws(typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(x)),
      computeRsaSha256Signature: (texte, cle) => [...crypto.sign('sha256', Buffer.from(texte), cle)],
      computeDigest: (_a, texte) => [...crypto.createHash('sha256').update(texte).digest()],
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      getUuid: () => crypto.randomUUID(),
    },
    UrlFetchApp: {
      fetch: (url, opts = {}) => {
        appels.push({ url, opts });
        const r = reponses(url, opts);
        return { getResponseCode: () => r.code, getContentText: () => r.corps };
      },
    },
    GmailApp: { getAliases: () => ['secretariat@himmelsweg.fr'], sendEmail: (...a) => emails.push(a) },
    ContentService: {
      createTextOutput: (t) => ({ texte: t, setMimeType() { return this; } }),
      MimeType: { JSON: 'json' },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('./Code.gs', import.meta.url), 'utf8') + '\n;this.__ = { ficheDepuisHelloAsso, enChamps, depuisChamps, enDateIso, synchroniser, doPost };', ctx);
  return { ...ctx.__, appels, emails, props };
}

const ITEM = {
  id: 987654,
  state: 'Processed',
  order: { date: '2027-01-15T10:20:00+01:00' },
  payer: { email: 'Parent@Exemple.fr', firstName: 'Paul', lastName: 'Ott' },
  user: { firstName: 'Françoise', lastName: 'Ott' },
  customFields: [
    { name: 'Date de naissance', answer: '15/09/2010' },
    { name: 'Téléphone portable', answer: '06 15 25 35 45' },
    { name: 'Contact en cas d’urgence : nom', answer: 'Paul Ott' },
    { name: 'Contact en cas d’urgence : téléphone', answer: '07 25 11 22 33' },
    { name: 'Informations de santé à signaler', answer: 'Asthme léger' },
    { name: 'Régime alimentaire', answer: 'Sans gluten' },
    { name: 'Pour les mineurs : nom du référent adulte', answer: 'Anne Ott' },
    { name: 'Pour les mineurs : téléphone du référent', answer: '06 99 88 77 66' },
    { name: 'Je me propose comme chef de chapitre', answer: 'Non' },
    { name: 'J’accepte que mes informations de santé soient connues des responsables sécurité', answer: 'Oui' },
  ],
};

test('une inscription HelloAsso devient une fiche complète', () => {
  const { ficheDepuisHelloAsso } = charger();
  const f = ficheDepuisHelloAsso(ITEM, 'F');
  assert.deepEqual(JSON.parse(JSON.stringify(f.membre)), {
    prenom: 'Françoise',
    nom: 'Ott',
    groupe: 'F',
    email: 'parent@exemple.fr',
    tel: '06 15 25 35 45',
    dateNaissance: '2010-09-15',
    chapitre: null,
    roles: ['pelerin'],
    volontaireChef: false,
    inscritLe: '2027-01-15',
    helloassoId: '987654',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(f.prive)), {
    urgenceNom: 'Paul Ott',
    urgenceTel: '07 25 11 22 33',
    sante: 'Asthme léger',
    regime: 'Sans gluten',
    referentNom: 'Anne Ott',
    referentTel: '06 99 88 77 66',
    consentementSante: true,
  });
});

test('un adulte : pas de référent, volontaire chef reconnu, régime « Aucun » vide', () => {
  const { ficheDepuisHelloAsso } = charger();
  const item = structuredClone(ITEM);
  item.customFields[0].answer = '1980-03-02';
  item.customFields[5].answer = 'Aucun';
  item.customFields[8].answer = 'Oui';
  const f = ficheDepuisHelloAsso(item, 'H');
  assert.equal(f.membre.dateNaissance, '1980-03-02');
  assert.equal(f.membre.volontaireChef, true);
  assert.equal(f.prive.regime, '');
  assert.equal(f.prive.referentNom, '');
});

test('les valeurs passent sans perte vers la base et retour', () => {
  const { enChamps, depuisChamps } = charger();
  const o = { a: 'x', b: true, c: 3, d: null, e: ['pelerin', 'chef'], f: { g: 1.5 } };
  assert.deepEqual(JSON.parse(JSON.stringify(depuisChamps(enChamps(o)))), o);
});

test('synchroniser crée la fiche, envoie le lien une seule fois', () => {
  const s = charger({
    proprietes: {
      HELLOASSO_CLIENT_ID: 'id',
      HELLOASSO_CLIENT_SECRET: 'secret',
      HELLOASSO_ORGANISATION: 'asso',
      FORMULAIRE_FEMMES: 'pelerines-2027',
    },
    reponses: (url) => {
      if (url.endsWith('/oauth2/token')) return { code: 200, corps: JSON.stringify({ access_token: 'jeton', expires_in: 1800 }) };
      if (url.endsWith('oauth2.googleapis.com/token')) return { code: 200, corps: JSON.stringify({ access_token: 'g' }) };
      if (url.includes('/items')) return { code: 200, corps: JSON.stringify({ data: [ITEM], pagination: {} }) };
      if (url.endsWith(':commit')) return { code: 200, corps: '{}' };
      return { code: 404, corps: '' };
    },
  });
  s.synchroniser();
  s.synchroniser(); // deuxième passage : rien de nouveau
  const commits = s.appels.filter((a) => a.url.endsWith(':commit'));
  assert.equal(commits.length, 1);
  const ecritures = JSON.parse(commits[0].opts.payload).writes;
  assert.match(ecritures[0].update.name, /documents\/membres\/ha-987654$/);
  assert.deepEqual(ecritures[0].currentDocument, { exists: false });
  assert.match(ecritures[1].update.name, /membres\/ha-987654\/prive\/fiche$/);
  assert.match(ecritures[2].update.name, /documents\/liens\/[A-Za-z0-9_-]{32}$/);
  assert.equal(s.emails.length, 1);
  const [a, sujet, texte, options] = s.emails[0];
  assert.equal(a, 'parent@exemple.fr');
  assert.match(sujet, /Himmelsweg/);
  assert.match(texte, /https:\/\/app\.himmelsweg\.fr\/#cle=[A-Za-z0-9_-]{32}/);
  assert.equal(options.from, 'secretariat@himmelsweg.fr');
  assert.equal(JSON.parse(s.props.IMPORTES).length, 1);
});

test('connexion : une clé valable donne un jeton Firebase correctement signé', () => {
  const s = charger({
    reponses: (url) => {
      if (url.endsWith('oauth2.googleapis.com/token')) return { code: 200, corps: JSON.stringify({ access_token: 'g' }) };
      if (url.endsWith('/liens/CleValable_1234567890')) return { code: 200, corps: JSON.stringify({ fields: { membreId: { stringValue: 'ha-987654' } } }) };
      return { code: 404, corps: '' };
    },
  });
  const ok = JSON.parse(s.doPost({ postData: { contents: JSON.stringify({ action: 'connexion', cle: 'CleValable_1234567890' }) } }).texte);
  const [h, c, sig] = ok.jeton.split('.');
  assert.ok(crypto.verify('sha256', Buffer.from(h + '.' + c), publicKey, Buffer.from(sig, 'base64url')));
  const contenu = JSON.parse(Buffer.from(c, 'base64url'));
  assert.equal(contenu.uid, 'ha-987654');
  assert.equal(contenu.iss, CLE_SA.client_email);
  assert.equal(contenu.aud, 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit');
  assert.ok(contenu.exp - contenu.iat <= 3600);

  const refus = JSON.parse(s.doPost({ postData: { contents: JSON.stringify({ action: 'connexion', cle: 'CleInconnue_123456789' }) } }).texte);
  assert.ok(!refus.jeton && refus.erreur);
  const bidon = JSON.parse(s.doPost({ postData: { contents: JSON.stringify({ action: 'connexion', cle: '../admins/x' }) } }).texte);
  assert.ok(!bidon.jeton);
});
