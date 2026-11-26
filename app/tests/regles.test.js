// Vérifie que la base refuse ce qu'il faut (RGPD). Lancer : npm run test:regles
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { collection, deleteDoc, doc, documentId, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-himmelsweg',
    firestore: { rules: readFileSync(new URL('../firebase/firestore.rules', import.meta.url), 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admins/directrice@gmail.com'), {});
    const m = (id, chapitre, roles) => setDoc(doc(db, 'membres', id), { prenom: id, chapitre, roles });
    await m('chefA', 'A', ['pelerin', 'chef']);
    await m('secuA', 'A', ['pelerin', 'securite']);
    await m('pelA', 'A', ['pelerin']);
    await m('pelB', 'B', ['pelerin']);
    await m('logi', 'B', ['pelerin', 'logistique']);
    await m('repas', 'B', ['pelerin', 'repas']);
    for (const id of ['chefA', 'secuA', 'pelA', 'pelB', 'logi', 'repas']) {
      await setDoc(doc(db, 'membres', id, 'prive', 'fiche'), { sante: 'secret' });
    }
    await setDoc(doc(db, 'membres/pelA/admin/lien'), { cle: 'abc' });
    await setDoc(doc(db, 'liens/abc'), { membreId: 'pelA' });
    await setDoc(doc(db, 'contenus/c1'), { titre: 'Liste' });
  });
});
after(() => env.cleanup());

const admin = () => env.authenticatedContext('google-uid', { email: 'directrice@gmail.com', email_verified: true }).firestore();
const intrus = () => env.authenticatedContext('autre-uid', { email: 'inconnu@gmail.com', email_verified: true }).firestore();
const membre = (id) => env.authenticatedContext(id).firestore();
const sante = (db, id) => getDoc(doc(db, 'membres', id, 'prive', 'fiche'));

test('un admin voit et modifie tout', async () => {
  await assertSucceeds(getDocs(collection(admin(), 'membres')));
  await assertSucceeds(sante(admin(), 'pelB'));
  await assertSucceeds(setDoc(doc(admin(), 'contenus/c2'), { titre: 'x' }));
  await assertSucceeds(setDoc(doc(admin(), 'membres/pelB'), { roles: ['pelerin', 'repas'], chapitre: 'B' }, { merge: true }));
});

test('une adresse Google non inscrite n’a aucun accès', async () => {
  await assertFails(getDocs(collection(intrus(), 'membres')));
  await assertFails(getDoc(doc(intrus(), 'contenus/c1')));
});

test('personne non connecté : rien', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'contenus/c1')));
});

test('un pèlerin voit sa fiche et les contenus, pas les autres', async () => {
  const db = membre('pelA');
  await assertSucceeds(getDoc(doc(db, 'membres/pelA')));
  await assertSucceeds(sante(db, 'pelA'));
  await assertSucceeds(getDoc(doc(db, 'contenus/c1')));
  await assertFails(getDoc(doc(db, 'membres/pelB')));
  await assertFails(sante(db, 'pelB'));
  await assertFails(getDocs(collection(db, 'membres')));
  await assertSucceeds(getDocs(query(collection(db, 'membres'), where(documentId(), '==', 'pelA'))));
});

test('un pèlerin ne peut ni se donner un rôle ni modifier les contenus', async () => {
  const db = membre('pelA');
  await assertFails(setDoc(doc(db, 'membres/pelA'), { roles: ['pelerin', 'logistique'] }, { merge: true }));
  await assertFails(setDoc(doc(db, 'contenus/c1'), { titre: 'pirate' }));
});

test('le chef voit son chapitre mais pas la santé', async () => {
  const db = membre('chefA');
  await assertSucceeds(getDocs(query(collection(db, 'membres'), where('chapitre', '==', 'A'))));
  await assertFails(getDocs(query(collection(db, 'membres'), where('chapitre', '==', 'B'))));
  await assertFails(sante(db, 'pelA'));
});

test('l’adjoint sécurité voit la santé de son chapitre seulement', async () => {
  const db = membre('secuA');
  await assertSucceeds(sante(db, 'pelA'));
  await assertFails(sante(db, 'pelB'));
});

test('la logistique voit tout le monde et la santé', async () => {
  const db = membre('logi');
  await assertSucceeds(getDocs(collection(db, 'membres')));
  await assertSucceeds(sante(db, 'pelA'));
});

test('l’équipe repas ne voit pas la santé ni les autres fiches', async () => {
  const db = membre('repas');
  await assertFails(sante(db, 'pelA'));
  await assertFails(getDocs(collection(db, 'membres')));
});

test('les clés de liens personnels sont illisibles sauf par l’admin', async () => {
  await assertFails(getDoc(doc(membre('pelA'), 'liens/abc')));
  await assertFails(getDoc(doc(admin(), 'liens/abc')));
  await assertFails(getDoc(doc(membre('pelA'), 'membres/pelA/admin/lien')));
  await assertSucceeds(getDoc(doc(admin(), 'membres/pelA/admin/lien')));
  await assertSucceeds(setDoc(doc(admin(), 'liens/nouvelle'), { membreId: 'pelA' }));
  await assertSucceeds(deleteDoc(doc(admin(), 'liens/abc')));
  await assertFails(setDoc(doc(membre('pelA'), 'liens/x'), { membreId: 'pelB' }));
});
