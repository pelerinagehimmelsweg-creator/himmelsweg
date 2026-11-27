// Vérifie que la base refuse ce qu'il faut (RGPD). Lancer : npm run test:regles
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { collection, deleteDoc, doc, documentId, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

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
    await setDoc(doc(db, 'equipes/repas'), { extras: 3 });
    await setDoc(doc(db, 'stats/repas'), { total: 6 });
    await setDoc(doc(db, 'parcours/e1'), { titre: 'Départ' });
    await setDoc(doc(db, 'prevoyance/p1'), { objet: 'Tentes' });
    await setDoc(doc(db, 'traces/t1'), { nom: 'Vendredi', trace: 'abc' });
    await setDoc(doc(db, 'photos/p1'), { auteur: 'pelA', statut: 'a_trier', vignette: 'x' });
    await setDoc(doc(db, 'photos/p2'), { auteur: 'pelB', statut: 'publiee', vignette: 'y' });
    await setDoc(doc(db, 'photos/p3'), { auteur: 'pelB', statut: 'a_trier', vignette: 'z' });
    await setDoc(doc(db, 'reperes/r1'), { type: 'eau', lat: 48, lng: 7 });
    await setDoc(doc(db, 'fils/logistique/messages/m1'), { auteur: 'logi', texte: 'Bonjour' });
    await setDoc(doc(db, 'alertes/a1'), { auteur: 'secuA', traitee: false });
    await setDoc(doc(db, 'config/app'), { smsAlerte: '06' });
    await setDoc(doc(db, 'questions/regime'), { libelle: 'Régime', type: 'choix' });
    await setDoc(doc(db, 'config/inscription'), { ouverte: true, tarifs: [] });
    await setDoc(doc(db, 'dossiers/d1'), { statut: 'en_attente', membres: ['pelA'], payeur: { email: 'x@y.fr' } });
    await setDoc(doc(db, 'membres/pelA'), { statut: 'en_attente', tel: '06', reponses: {} }, { merge: true });
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

test('le questionnaire et les tarifs sont publics, mais seuls les admins les modifient', async () => {
  const anonyme = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(collection(anonyme, 'questions')));
  await assertSucceeds(getDoc(doc(anonyme, 'config/inscription')));
  await assertFails(setDoc(doc(anonyme, 'questions/pirate'), { libelle: 'x' }));
  await assertFails(setDoc(doc(membre('pelA'), 'config/inscription'), { ouverte: false }));
  await assertSucceeds(setDoc(doc(admin(), 'questions/nouvelle'), { libelle: 'Taille de t-shirt', type: 'choix' }));
  await assertSucceeds(setDoc(doc(admin(), 'config/inscription'), { ouverte: true, tarifs: [] }));
});

test('les dossiers d’inscription (paiements) sont réservés aux admins', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'dossiers/d1')));
  await assertFails(getDoc(doc(membre('pelA'), 'dossiers/d1')));
  await assertFails(getDoc(doc(membre('logi'), 'dossiers/d1')));
  await assertFails(setDoc(doc(membre('pelA'), 'dossiers/d1'), { statut: 'paye' }, { merge: true }));
  await assertSucceeds(getDoc(doc(admin(), 'dossiers/d1')));
  await assertSucceeds(setDoc(doc(admin(), 'dossiers/d1'), { statut: 'valide_main' }, { merge: true }));
});

test('un pèlerin corrige ses réponses, mais pas son paiement ni la fiche des autres', async () => {
  const db = membre('pelA');
  await assertSucceeds(setDoc(doc(db, 'membres/pelA'), { tel: '07 00 00 00 00', reponses: { volontaireChef: 'Oui' }, volontaireChef: true }, { merge: true }));
  await assertSucceeds(setDoc(doc(db, 'membres/pelA/prive/fiche'), { sante: 'Rien', regime: 'Végétarien' }));
  await assertFails(setDoc(doc(db, 'membres/pelA'), { statut: 'inscrit' }, { merge: true }));
  await assertFails(setDoc(doc(db, 'membres/pelA'), { chapitre: 'B' }, { merge: true }));
  await assertFails(setDoc(doc(db, 'membres/pelB'), { tel: '07' }, { merge: true }));
  await assertFails(setDoc(doc(db, 'membres/pelB/prive/fiche'), { sante: 'x' }));
  await assertFails(setDoc(doc(db, 'membres/pelA/admin/lien'), { cle: 'x' }));
});

test('repas : l’équipe repas voit les quantités et le nombre par régime, pas les autres', async () => {
  await assertSucceeds(getDoc(doc(membre('repas'), 'equipes/repas')));
  await assertSucceeds(setDoc(doc(membre('repas'), 'equipes/repas'), { extras: 5 }));
  await assertSucceeds(getDoc(doc(membre('repas'), 'stats/repas')));
  await assertSucceeds(setDoc(doc(membre('repas'), 'fournisseurs/f1'), { nom: 'Boulangerie' }));
  await assertFails(setDoc(doc(membre('repas'), 'stats/repas'), { total: 1 }));
  await assertFails(getDoc(doc(membre('pelA'), 'equipes/repas')));
  await assertFails(getDoc(doc(membre('pelA'), 'stats/repas')));
});

test('logistique : parcours et prévoyance ; chefs et pèlerins lisent le parcours sans le modifier', async () => {
  await assertSucceeds(setDoc(doc(membre('logi'), 'parcours/e2'), { titre: 'Arrivée' }));
  await assertSucceeds(setDoc(doc(membre('logi'), 'prevoyance/p2'), { objet: 'Trousses' }));
  await assertSucceeds(getDoc(doc(membre('chefA'), 'parcours/e1')));
  await assertFails(setDoc(doc(membre('chefA'), 'parcours/e1'), { titre: 'x' }));
  await assertFails(getDoc(doc(membre('chefA'), 'prevoyance/p1')));
  await assertSucceeds(getDoc(doc(membre('pelA'), 'parcours/e1')));
  await assertFails(setDoc(doc(membre('pelA'), 'parcours/e1'), { titre: 'x' }));
});

test('carte : traces et repères lus par tous, posés par la logistique', async () => {
  await assertSucceeds(getDocs(collection(membre('pelA'), 'traces')));
  await assertSucceeds(getDoc(doc(membre('pelB'), 'reperes/r1')));
  await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'traces')));
  await assertFails(setDoc(doc(membre('pelA'), 'reperes/r2'), { type: 'eau', lat: 1, lng: 2 }));
  await assertFails(setDoc(doc(membre('chefA'), 'traces/t2'), { nom: 'x' }));
  await assertSucceeds(setDoc(doc(membre('logi'), 'reperes/r2'), { type: 'eau', lat: 1, lng: 2 }));
  await assertSucceeds(setDoc(doc(membre('logi'), 'traces/t2'), { nom: 'Samedi', trace: 'def' }));
  await assertSucceeds(deleteDoc(doc(admin(), 'reperes/r2')));
});

test('position des chefs : le chef écrit la sienne, seule la logistique la voit', async () => {
  const pos = { lat: 48.1, lng: 7.3, precision: 12, maj: '2027-05-08T10:00:00Z', nom: 'Chef A', chapitre: 'A' };
  await assertSucceeds(setDoc(doc(membre('chefA'), 'positions/chefA'), pos));
  await assertFails(setDoc(doc(membre('chefA'), 'positions/pelA'), pos));
  await assertFails(setDoc(doc(membre('pelA'), 'positions/pelA'), pos));
  await assertFails(setDoc(doc(membre('chefA'), 'positions/chefA'), { ...pos, sante: 'x' }));
  await assertFails(getDoc(doc(membre('chefA'), 'positions/chefA')));
  await assertFails(getDocs(collection(membre('pelA'), 'positions')));
  await assertFails(getDocs(collection(membre('secuA'), 'positions')));
  await assertSucceeds(getDocs(collection(membre('logi'), 'positions')));
  await assertSucceeds(getDocs(collection(admin(), 'positions')));
  await assertFails(deleteDoc(doc(membre('logi'), 'positions/chefA')));
  await assertSucceeds(deleteDoc(doc(membre('chefA'), 'positions/chefA')));
});

test('photos : galerie pour les participants, photos à trier pour l’auteur et les admins', async () => {
  const pel = membre('pelA');
  await assertSucceeds(getDocs(query(collection(pel, 'photos'), where('statut', '==', 'publiee'))));
  await assertSucceeds(getDocs(query(collection(pel, 'photos'), where('auteur', '==', 'pelA'))));
  await assertSucceeds(getDoc(doc(pel, 'photos/p1')));
  await assertFails(getDoc(doc(pel, 'photos/p3')));
  await assertFails(getDocs(query(collection(pel, 'photos'), where('statut', '==', 'a_trier'))));
  await assertFails(getDocs(query(collection(env.unauthenticatedContext().firestore(), 'photos'), where('statut', '==', 'publiee'))));
  await assertSucceeds(getDocs(query(collection(admin(), 'photos'), where('statut', '==', 'a_trier'))));
  await assertFails(setDoc(doc(pel, 'photos/p1'), { auteur: 'pelA', statut: 'publiee' }));
  await assertFails(setDoc(doc(admin(), 'photos/p9'), { statut: 'publiee' }));
});

test('discussions : chacun son équipe, messages signés', async () => {
  await assertSucceeds(getDocs(collection(membre('logi'), 'fils/logistique/messages')));
  await assertSucceeds(setDoc(doc(membre('logi'), 'fils/logistique/messages/m2'), { auteur: 'logi', texte: 'OK' }));
  await assertFails(setDoc(doc(membre('logi'), 'fils/logistique/messages/m3'), { auteur: 'chefA', texte: 'faux' }));
  await assertFails(getDocs(collection(membre('repas'), 'fils/logistique/messages')));
  await assertFails(getDocs(collection(membre('logi'), 'fils/admins/messages')));
  await assertSucceeds(getDocs(collection(admin(), 'fils/admins/messages')));
});

test('alertes : lancées par l’adjoint sécurité, vues par la logistique', async () => {
  await assertSucceeds(setDoc(doc(membre('secuA'), 'alertes/a2'), { auteur: 'secuA', message: 'Chute' }));
  await assertFails(setDoc(doc(membre('pelA'), 'alertes/a3'), { auteur: 'pelA' }));
  await assertSucceeds(getDoc(doc(membre('logi'), 'alertes/a1')));
  await assertSucceeds(getDoc(doc(membre('secuA'), 'alertes/a1')));
  await assertFails(getDoc(doc(membre('pelA'), 'alertes/a1')));
  await assertSucceeds(setDoc(doc(membre('logi'), 'alertes/a1'), { traitee: true }, { merge: true }));
  await assertFails(setDoc(doc(membre('logi'), 'alertes/a1'), { message: 'changé' }, { merge: true }));
});

test('le chef nomme l’adjoint sécurité de son chapitre, rien d’autre', async () => {
  const db = membre('chefA');
  await assertSucceeds(setDoc(doc(db, 'membres/pelA'), { roles: ['pelerin', 'securite'] }, { merge: true }));
  await assertSucceeds(setDoc(doc(db, 'membres/pelA'), { roles: ['pelerin'] }, { merge: true }));
  await assertFails(setDoc(doc(db, 'membres/pelA'), { roles: ['pelerin', 'logistique'] }, { merge: true }));
  await assertFails(setDoc(doc(db, 'membres/pelA'), { chapitre: 'B' }, { merge: true }));
  await assertFails(setDoc(doc(db, 'membres/pelB'), { roles: ['pelerin', 'securite'] }, { merge: true }));
});

test('jetons de notification et numéro d’alerte', async () => {
  await assertSucceeds(setDoc(doc(membre('pelA'), 'jetons/pelA'), { token: 't' }));
  await assertFails(setDoc(doc(membre('pelA'), 'jetons/pelB'), { token: 't' }));
  await assertFails(getDoc(doc(membre('pelA'), 'jetons/pelA')));
  await assertSucceeds(getDoc(doc(membre('pelA'), 'config/app')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'config/app')));
  await assertFails(setDoc(doc(membre('logi'), 'config/app'), { smsAlerte: '07' }));
});

test('questionnaire de fin : une réponse par participant, anonyme possible, lue par les admins seuls', async () => {
  const repondre = (db, uid, id, r) => {
    const lot = writeBatch(db);
    lot.set(doc(db, 'bilan', id), { reponses: { organisation: 5 }, groupe: 'F', jour: '2027-05-10', ...r });
    lot.set(doc(db, 'bilanFait', uid), { jour: '2027-05-10' });
    return lot.commit();
  };
  // Nominatif : l'identifiant est celui du participant.
  await assertFails(repondre(membre('pelB'), 'pelB', 'pelA', { anonyme: false, auteur: 'pelA', nom: 'A' }));
  await assertSucceeds(repondre(membre('pelB'), 'pelB', 'pelB', { anonyme: false, auteur: 'pelB', nom: 'B' }));
  // Une seule fois.
  await assertFails(repondre(membre('pelB'), 'pelB', 'xyz', { anonyme: true }));
  // Anonyme : ni auteur ni nom.
  await assertFails(repondre(membre('chefA'), 'chefA', 'anon1', { anonyme: true, nom: 'Chef' }));
  await assertSucceeds(repondre(membre('chefA'), 'chefA', 'anon1', { anonyme: true, temoignage: 'Merci', publier: true, signature: 'Un pèlerin' }));
  // Sans la marque « a répondu », pas de réponse (sinon on pourrait répondre plusieurs fois anonymement).
  await assertFails(setDoc(doc(membre('secuA'), 'bilan/anon2'), { reponses: {}, anonyme: true }));
  // On ne se retient pas soi-même, on ne lit pas les réponses.
  await assertFails(repondre(membre('logi'), 'logi', 'logi', { anonyme: false, auteur: 'logi', retenu: true }));
  await assertFails(getDoc(doc(membre('pelB'), 'bilan/pelB')));
  await assertFails(getDocs(collection(membre('chefA'), 'bilan')));
  await assertSucceeds(getDoc(doc(membre('pelB'), 'bilanFait/pelB')));
  await assertFails(getDoc(doc(membre('pelB'), 'bilanFait/chefA')));
  await assertFails(repondre(intrus(), 'autre-uid', 'autre-uid', { anonyme: false, auteur: 'autre-uid' }));
  // Les admins lisent tout et retiennent un témoignage, sans changer la réponse.
  await assertSucceeds(getDocs(collection(admin(), 'bilan')));
  await assertSucceeds(getDocs(collection(admin(), 'bilanFait')));
  await assertSucceeds(updateDoc(doc(admin(), 'bilan/anon1'), { retenu: true }));
  await assertFails(updateDoc(doc(admin(), 'bilan/anon1'), { temoignage: 'autre' }));
  // Config du questionnaire : lue par les participants, écrite par les admins.
  await assertSucceeds(setDoc(doc(admin(), 'config/bilan'), { ouverture: 'auto' }));
  await assertSucceeds(getDoc(doc(membre('pelB'), 'config/bilan')));
  await assertFails(setDoc(doc(membre('pelB'), 'config/bilan'), { ouverture: 'ouvert' }));
});

test('notifications programmées : réservées aux admins', async () => {
  await assertSucceeds(setDoc(doc(admin(), 'programmees/p1'), { titre: 'Réveil', le: '2027-05-08T04:30:00Z' }));
  await assertSucceeds(getDocs(collection(admin(), 'programmees')));
  await assertFails(getDocs(collection(membre('chefA'), 'programmees')));
  await assertFails(setDoc(doc(membre('logi'), 'programmees/p2'), { titre: 'x' }));
  await assertSucceeds(deleteDoc(doc(admin(), 'programmees/p1')));
});
