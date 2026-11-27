// Les modèles de notification du service worker et de l'app sont les mêmes. Lancer : node --test tests/notifications.test.js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { MODELES_NOTIFICATION, notificationAffichee } from '../src/donnees/notifications.js';

const publicDir = new URL('../public/', import.meta.url);

test('mêmes modèles pour le service worker et l’app, chacun avec sa photo', () => {
  const ctx = { self: {} };
  vm.runInNewContext(readFileSync(new URL('notifications/modeles.js', publicDir), 'utf8'), ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.self.MODELES_NOTIFICATION)), MODELES_NOTIFICATION);
  for (const id of Object.keys(MODELES_NOTIFICATION)) assert.ok(existsSync(new URL(`notifications/${id}.jpg`, publicDir)), id);
  for (const id of Object.keys(MODELES_NOTIFICATION)) assert.ok(existsSync(new URL(`notifications/fond-${id}.jpg`, publicDir)), `fond-${id}`);
  for (const f of ['badge.png', 'blason.png', 'cinzel-700.woff2', 'affiche.js']) assert.ok(existsSync(new URL(`notifications/${f}`, publicDir)), f);
});

test('modèle inconnu : annonce ; lien et bouton du modèle sauf s’ils sont donnés', () => {
  assert.equal(notificationAffichee({ modele: 'xx', titre: 'A' }).modele, 'annonce');
  const n = notificationAffichee({ modele: 'rendezvous', titre: 'A', texte: 'B' });
  assert.equal(n.lien, '/#/carte');
  assert.equal(n.bouton, 'Voir la carte');
  assert.equal(notificationAffichee({ modele: 'merci', lien: '/#/bilan', bouton: 'Répondre' }).bouton, 'Répondre');
});

test('le service worker affiche le modèle reçu, avec photo, croix et bouton', async () => {
  const montrees = [];
  const ecouteurs = {};
  const self = {
    navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120' },
    addEventListener: (t, f) => (ecouteurs[t] = f),
    registration: { showNotification: async (titre, o) => montrees.push({ titre, ...o }) },
    clients: { matchAll: async () => [], openWindow: async () => {}, claim: async () => {} },
    skipWaiting: () => {},
  };
  const charger = (...urls) => urls.forEach((u) => vm.runInNewContext(readFileSync(new URL(u.slice(1), publicDir), 'utf8'), { self }));
  const ctx = { self, importScripts: charger, setTimeout, FileReader: undefined };
  vm.runInNewContext(readFileSync(new URL('firebase-messaging-sw.js', publicDir), 'utf8'), ctx);
  let attente;
  ecouteurs.push({ data: { json: () => ({ data: { modele: 'rendezvous', titre: 'Rendez-vous à 7 h 30', texte: 'Messe' } }) }, waitUntil: (p) => (attente = p) });
  await attente;
  assert.equal(montrees[0].titre, '🔔 Rendez-vous à 7 h 30');
  // Sans dessin possible (ici, pas de toile), on garde la photo simple du modèle.
  assert.equal(montrees[0].image, '/notifications/rendezvous.jpg');
  assert.equal(montrees[0].badge, '/notifications/badge.png');
  assert.equal(montrees[0].actions[0].title, 'Voir la carte');
  assert.equal(montrees[0].data.lien, '/#/carte');
});

test('à son prénom : remplacé, ou retiré proprement si le prénom manque', async () => {
  const { personnaliser } = await import('../src/donnees/notifications.js');
  assert.equal(personnaliser('{prénom}, rendez-vous à 7 h 30', 'Anne'), 'Anne, rendez-vous à 7 h 30');
  assert.equal(personnaliser('Bonne nuit {Prenom} !', 'Paul'), 'Bonne nuit Paul !');
  assert.equal(personnaliser('{prénom}, rendez-vous à 7 h 30', ''), 'Rendez-vous à 7 h 30');
  assert.equal(personnaliser('Merci {prénom} !', undefined), 'Merci !');
  assert.equal(personnaliser('Merci, {prénom}.', ''), 'Merci.');
  assert.equal(personnaliser('Sans marqueur', 'Anne'), 'Sans marqueur');
});

test('titre sur la photo : sans emoji, sur deux lignes au plus, raccourci si trop long', () => {
  const ctx = { self: {} };
  vm.runInNewContext(readFileSync(new URL('notifications/affiche.js', publicDir), 'utf8'), ctx);
  const { titreAffiche, couper } = ctx.self.AFFICHE_NOTIFICATION;
  assert.equal(titreAffiche('🔔  Rendez-vous ⚠️ à 7 h 30 '), 'Rendez-vous à 7 h 30');
  const mesure = (t, taille) => t.length * taille * 0.6; // largeur approchée d'une lettre
  const court = couper('Anne, rendez-vous à 7 h 30', mesure, 844);
  assert.equal(court.taille, 68);
  assert.deepEqual([...court.lignes], ['Anne, rendez-vous', 'à 7 h 30']);
  const moyen = couper('Paul, la messe de clôture commence à la cathédrale', mesure, 844);
  assert.equal(moyen.lignes.length, 2);
  assert.ok(moyen.taille >= 34);
  const long = couper('mot '.repeat(80).trim(), mesure, 844);
  assert.equal(long.taille, 34);
  assert.equal(long.lignes.length, 2);
  assert.ok(long.lignes[1].endsWith('…'));
  assert.ok(long.lignes.every((l) => mesure(l, 34) <= 844));
});
