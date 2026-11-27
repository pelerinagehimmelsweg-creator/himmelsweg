// Lecture des GPX et traces compactes. Lancer : node --test tests/carte.test.js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decoder, distanceKm, encoder, ilYa, lireGpx, nouvelleTrace, simplifier } from '../src/donnees/carte.js';

const GPX = `<?xml version="1.0"?><gpx version="1.1" creator="test"><metadata><name>Fichier</name></metadata>
<trk><name>Jour 1</name><trkseg><trkpt lat="48.2875" lon="7.4206"><ele>180</ele></trkpt><trkpt lat="48.2702" lon="7.4011"/><trkpt lat='48.1951' lon='7.3193'/></trkseg></trk>
<trk><name><![CDATA[Jour 2]]></name><trkseg><trkpt lon="7.3193" lat="48.1951"/><trkpt lat="48.0872" lon="7.2786"/></trkseg></trk></gpx>`;

test('un GPX avec deux traces donne deux traces nommées', () => {
  const t = lireGpx(GPX, 'f.gpx');
  assert.deepEqual(t.map((x) => x.nom), ['Jour 1', 'Jour 2']);
  assert.deepEqual(t[0].points[0], [48.2875, 7.4206]);
  assert.deepEqual(t[1].points[0], [48.1951, 7.3193]);
});

test('un GPX sans trace mais avec un itinéraire est accepté ; un autre fichier est refusé', () => {
  const r = lireGpx('<gpx><rte><rtept lat="1" lon="2"/><rtept lat="1.1" lon="2.1"/></rte></gpx>', 'Route');
  assert.equal(r[0].nom, 'Route');
  assert.throws(() => lireGpx('<html></html>'), /pas un fichier GPX/);
  assert.throws(() => lireGpx('<gpx></gpx>'), /Aucun tracé/);
});

test('encodage compact aller-retour, à 1 m près', () => {
  const pts = [[48.28751, 7.42063], [48.1, -7.3], [-12.5, 100.12345]];
  const d = decoder(encoder(pts));
  pts.forEach(([a, o], i) => {
    assert.ok(Math.abs(d[i][0] - a) < 1e-5 && Math.abs(d[i][1] - o) < 1e-5);
  });
});

test('une longue trace est allégée sous la limite en gardant les extrémités', () => {
  const pts = Array.from({ length: 20000 }, (_, i) => [48 + i * 1e-5, 7 + Math.sin(i / 50) * 1e-3]);
  const s = simplifier(pts, 1500);
  assert.ok(s.length <= 1500 && s.length > 50);
  assert.deepEqual(s[0], pts[0]);
  assert.deepEqual(s.at(-1), pts.at(-1));
  const t = nouvelleTrace({ nom: 'x', points: pts });
  assert.ok(t.trace.length < 40000, 'tient largement dans un document');
});

test('distance et « il y a »', () => {
  const km = distanceKm([[48.2875, 7.4206], [48.1951, 7.3193]]);
  assert.ok(km > 12 && km < 13);
  const t = Date.parse('2027-05-08T10:00:00Z');
  assert.equal(ilYa('2027-05-08T09:55:00Z', t), 'il y a 5 min');
  assert.equal(ilYa('2027-05-08T08:50:00Z', t), 'il y a 1 h 10');
});
