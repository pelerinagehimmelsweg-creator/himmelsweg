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
  assert.ok(existsSync(new URL('notifications/badge.png', publicDir)));
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
  const ctx = { self, importScripts: () => vm.runInNewContext(readFileSync(new URL('notifications/modeles.js', publicDir), 'utf8'), { self }) };
  vm.runInNewContext(readFileSync(new URL('firebase-messaging-sw.js', publicDir), 'utf8'), ctx);
  let attente;
  ecouteurs.push({ data: { json: () => ({ data: { modele: 'rendezvous', titre: 'Rendez-vous à 7 h 30', texte: 'Messe' } }) }, waitUntil: (p) => (attente = p) });
  await attente;
  assert.equal(montrees[0].titre, '🔔 Rendez-vous à 7 h 30');
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
