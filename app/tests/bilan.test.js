// Questionnaire de fin : ouverture, anonymat, résultats. Lancer : node --test tests/bilan.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BILAN_DEPART, bilanOuvert, csvBilan, erreursBilan, questionsBilan, reponseBilan, resultatsBilan } from '../src/donnees/bilan.js';

const session = { id: 'm1', prenom: 'Anne', nom: 'Zimmermann', groupe: 'F' };
const questions = questionsBilan({});

test('ouverture : automatique le dimanche 9 mai à 19 h, ou forcée par les admins', () => {
  assert.equal(bilanOuvert({}, Date.parse('2027-05-09T16:59:00Z')), false);
  assert.equal(bilanOuvert({}, Date.parse('2027-05-09T17:00:00Z')), true);
  assert.equal(bilanOuvert({ ouverture: 'ouvert' }, Date.parse('2026-12-01')), true);
  assert.equal(bilanOuvert({ ouverture: 'ferme' }, Date.parse('2027-06-01')), false);
  assert.equal(questionsBilan({ questions: [] }).length, BILAN_DEPART.length);
});

test('réponse anonyme : ni identifiant ni nom, témoignage signé « Une pèlerine »', () => {
  const r = reponseBilan({ questions, session, reponses: { organisation: 5, touche: '  La messe  ' }, anonyme: true, temoignage: 'Merci !', publier: true, jour: '2027-05-10' });
  assert.equal(r.auteur, undefined);
  assert.equal(r.nom, undefined);
  assert.deepEqual(r.reponses, { organisation: 5, touche: 'La messe' });
  assert.equal(r.signature, 'Une pèlerine');
  const n = reponseBilan({ questions, session, reponses: {}, anonyme: false, temoignage: '', jour: '2027-05-10' });
  assert.equal(n.auteur, 'm1');
  assert.equal(n.nom, 'Anne Zimmermann');
  assert.equal(n.temoignage, undefined);
});

test('erreurs : questions obligatoires et notes de 1 à 5', () => {
  const qs = [{ id: 'a', type: 'note', obligatoire: true, libelle: 'A' }, { id: 'b', type: 'note', libelle: 'B' }];
  assert.deepEqual(Object.keys(erreursBilan(qs, 'F', { b: 7 })).sort(), ['a', 'b']);
  assert.deepEqual(erreursBilan(qs, 'F', { a: 4 }), {});
});

test('résultats : moyennes, choix, réponses par chapitre et export', () => {
  const reponses = [
    { id: 'm1', anonyme: false, nom: 'Anne Z', groupe: 'F', jour: '2027-05-10', reponses: { organisation: 5, revenir: 'Oui', idee: 'Plus de pauses; svp' } },
    { id: 'x', anonyme: true, groupe: 'H', jour: '2027-05-11', reponses: { organisation: 3, revenir: 'Peut-être' } },
  ];
  const membres = [
    { id: 'm1', chapitre: 'c1', roles: ['pelerin'], statut: 'inscrit' },
    { id: 'm2', chapitre: 'c1', roles: ['pelerin'], statut: 'inscrit' },
    { id: 'm3', chapitre: 'c2', roles: ['pelerin'], statut: 'inscrit' },
    { id: 'm4', chapitre: 'c2', roles: ['pelerin'], statut: 'en_attente' },
  ];
  const r = resultatsBilan(questions, reponses, membres, [{ id: 'c1', nom: 'Sainte-Odile' }, { id: 'c2', nom: 'Saint-Joseph' }], [{ id: 'm1' }, { id: 'm3' }]);
  assert.equal(r.inscrits, 3);
  assert.equal(r.repondu, 2);
  assert.deepEqual(r.parChapitre, [{ nom: 'Sainte-Odile', total: 2, repondu: 1 }, { nom: 'Saint-Joseph', total: 1, repondu: 1 }]);
  const org = r.parQuestion.find((x) => x.q.id === 'organisation');
  assert.equal(org.moyenne, 4);
  assert.deepEqual(org.comptes, [0, 0, 1, 0, 1]);
  assert.deepEqual(r.parQuestion.find((x) => x.q.id === 'revenir').comptes, [1, 1, 0]);
  assert.deepEqual(r.parQuestion.find((x) => x.q.id === 'idee').textes, [{ texte: 'Plus de pauses; svp', qui: 'Anne Z' }]);
  const csv = csvBilan(questions, reponses).split('\r\n');
  assert.equal(csv.length, 3);
  assert.match(csv[1], /"Plus de pauses; svp"/);
  assert.match(csv[2], /^2027-05-11;Anonyme;Pèlerin;3/);
});
