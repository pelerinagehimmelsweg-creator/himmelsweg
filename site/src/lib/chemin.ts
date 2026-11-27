// Carte du chemin (même dessin que l'accueil animé de l'app : app/src/composants/accueil-invite.jsx).
import { ALSACE } from './alsace';

type Point = [number, number];

// Tracé approximatif (latitude, longitude) et les quatre étapes (indice du point dans le tracé).
export const CHEMIN: Point[] = [
  [48.2875, 7.4206], [48.2702, 7.4011], [48.2537, 7.3862], [48.2391, 7.3655], [48.2238, 7.3487], [48.2104, 7.3352], [48.1951, 7.3193],
  [48.1788, 7.3125], [48.1622, 7.3087], [48.1447, 7.2951], [48.1265, 7.2903], [48.1083, 7.2839], [48.0872, 7.2786],
  [48.0851, 7.2958], [48.0832, 7.3164], [48.0815, 7.3352], [48.0819, 7.3497],
];
export const VILLES_ETAPES = [
  { i: 0, nom: 'Scherwiller' },
  { i: 6, nom: 'Ribeauvillé' },
  { i: 12, nom: 'Turckheim' },
  { i: 16, nom: 'Colmar' },
];
const REPERES = [
  { nom: 'Strasbourg', p: [48.5734, 7.7521] as Point },
  { nom: 'Colmar', p: [48.0794, 7.3585] as Point },
  { nom: 'Mulhouse', p: [47.7508, 7.3359] as Point },
];

export const LARGEUR = 300;
export const HAUTEUR = 400;
const KX = Math.cos((48.25 * Math.PI) / 180);

function projection(contour: Point[], largeur = LARGEUR, hauteur = HAUTEUR, marge = 14) {
  const xs = contour.map(([, lon]) => lon * KX);
  const ys = contour.map(([lat]) => -lat);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const e = Math.min((largeur - 2 * marge) / (x1 - x0), (hauteur - 2 * marge) / (y1 - y0));
  const dx = (largeur - (x1 - x0) * e) / 2;
  const dy = (hauteur - (y1 - y0) * e) / 2;
  return ([lat, lon]: Point): Point => [+(dx + (lon * KX - x0) * e).toFixed(1), +(dy + (-lat - y0) * e).toFixed(1)];
}
const trace = (pts: Point[]) => `M${pts.map((p) => p.join(' ')).join(' L')}`;

/** Contour, tracé (entier et par journée), étapes placées après zoom, et cadrage du zoom. */
export function carteChemin(zoom = 2.1) {
  const proj = projection(ALSACE);
  const pts = CHEMIN.map(proj);
  const cumul = [0];
  for (let k = 1; k < pts.length; k++) cumul.push(cumul[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const total = cumul[cumul.length - 1] || 1;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const my = (Math.min(...ys) + Math.max(...ys)) / 2;
  const vers = ([x, y]: Point): Point => [+(LARGEUR / 2 + (x - mx) * zoom).toFixed(1), +(HAUTEUR / 2 + (y - my) * zoom).toFixed(1)];
  const etapes = VILLES_ETAPES.map((v) => ({ ...v, xy: vers(pts[v.i]), part: cumul[v.i] / total }));
  return {
    contour: `${trace(ALSACE.map(proj))} Z`,
    trace: trace(pts),
    // Une journée = d'une étape à la suivante.
    jours: etapes.slice(0, -1).map((e, k) => trace(pts.slice(e.i, etapes[k + 1].i + 1))),
    etapes,
    reperes: REPERES.map((r) => ({ ...r, xy: proj(r.p) })),
    transform: `translate(${(LARGEUR / 2 - mx * zoom).toFixed(1)}px, ${(HAUTEUR / 2 - my * zoom).toFixed(1)}px) scale(${zoom})`,
  };
}
