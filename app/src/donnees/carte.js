// Carte du parcours : lecture des fichiers GPX, traces compactes, repères.
// Aucune dépendance au navigateur ici, pour pouvoir le tester avec node.

export const REPERES = [
  { id: 'bivouac', nom: 'Bivouac', signe: '⛺', couleur: '#2f6b3a' },
  { id: 'pique-nique', nom: 'Pique-nique', signe: '🧺', couleur: '#a8661b' },
  { id: 'eau', nom: 'Point d’eau', signe: '💧', couleur: '#1f6fb2' },
  { id: 'toilettes', nom: 'Toilettes', signe: 'WC', couleur: '#5d544d' },
  { id: 'eglise', nom: 'Église', signe: '✝', couleur: '#8a1f18' },
  { id: 'secours', nom: 'Poste de secours', signe: '✚', couleur: '#d0261b' },
  { id: 'rendez-vous', nom: 'Rendez-vous', signe: '★', couleur: '#b32d24' },
];
export const repereDe = (type) => REPERES.find((r) => r.id === type) ?? REPERES.at(-1);

/** Couleurs des traces, une par jour. */
export const COULEURS = ['#b32d24', '#1f6fb2', '#2f6b3a', '#7a3fa0', '#a8661b'];

const attr = (balise, nom) => {
  const m = new RegExp(`\\b${nom}\\s*=\\s*["']([^"']+)["']`).exec(balise);
  return m ? Number(m[1]) : NaN;
};
const nomDans = (xml) => {
  const m = /<name>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/name>/.exec(xml);
  return m ? m[1].trim() : '';
};
const points = (xml, balise) =>
  [...xml.matchAll(new RegExp(`<${balise}\\b[^>]*>`, 'g'))]
    .map((m) => [attr(m[0], 'lat'), attr(m[0], 'lon')])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));

/**
 * Lit un fichier GPX : une trace par <trk> (ou par <rte> s'il n'y a pas de trace).
 * Renvoie [{ nom, points: [[lat, lng], ...] }].
 */
export function lireGpx(xml, nomFichier = 'Parcours') {
  if (!/<gpx\b/i.test(xml)) throw new Error('Ce fichier n’est pas un fichier GPX.');
  const blocs = (balise, pt) =>
    [...xml.matchAll(new RegExp(`<${balise}\\b[\\s\\S]*?</${balise}>`, 'g'))]
      .map((m, i, tous) => ({
        nom: nomDans(m[0].replace(new RegExp(`<${pt}\\b[\\s\\S]*$`), '')) || (tous.length > 1 ? `${nomFichier} (${i + 1})` : nomFichier),
        points: points(m[0], pt),
      }))
      .filter((t) => t.points.length > 1);
  const traces = blocs('trk', 'trkpt');
  const res = traces.length ? traces : blocs('rte', 'rtept');
  if (!res.length) throw new Error('Aucun tracé trouvé dans ce fichier GPX.');
  return res;
}

/** Distance en km le long des points. */
export function distanceKm(pts) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  let km = 0;
  for (let i = 1; i < pts.length; i++) {
    const [a1, o1] = pts[i - 1];
    const [a2, o2] = pts[i];
    const h = Math.sin(rad(a2 - a1) / 2) ** 2 + Math.cos(rad(a1)) * Math.cos(rad(a2)) * Math.sin(rad(o2 - o1) / 2) ** 2;
    km += 2 * R * Math.asin(Math.sqrt(h));
  }
  return km;
}

/** Allège une trace (Douglas-Peucker) : on garde la forme, avec beaucoup moins de points. */
export function simplifier(pts, max = 3000) {
  if (pts.length <= 2) return pts;
  const garder = (tol) => {
    const k = new Uint8Array(pts.length);
    k[0] = k[pts.length - 1] = 1;
    const pile = [[0, pts.length - 1]];
    while (pile.length) {
      const [d, f] = pile.pop();
      const [y1, x1] = pts[d];
      const [y2, x2] = pts[f];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      let iMax = -1;
      let dMax = tol * tol;
      for (let i = d + 1; i < f; i++) {
        const [y, x] = pts[i];
        let t = l2 ? ((x - x1) * dx + (y - y1) * dy) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        const ex = x1 + t * dx - x;
        const ey = y1 + t * dy - y;
        const d2 = ex * ex + ey * ey;
        if (d2 > dMax) {
          dMax = d2;
          iMax = i;
        }
      }
      if (iMax > 0) {
        k[iMax] = 1;
        pile.push([d, iMax], [iMax, f]);
      }
    }
    return pts.filter((_, i) => k[i]);
  };
  let tol = 0.00002; // environ 2 m
  let res = garder(tol);
  while (res.length > max) res = garder((tol *= 2));
  return res;
}

/** Trace compacte (format « polyline » de Google, précision ~1 m) : tient dans un seul document. */
export function encoder(pts) {
  let s = '';
  let pa = 0;
  let po = 0;
  const un = (v) => {
    v = v < 0 ? ~(v << 1) : v << 1;
    while (v >= 0x20) {
      s += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    s += String.fromCharCode(v + 63);
  };
  for (const [a, o] of pts) {
    const ia = Math.round(a * 1e5);
    const io = Math.round(o * 1e5);
    un(ia - pa);
    un(io - po);
    pa = ia;
    po = io;
  }
  return s;
}

export function decoder(s = '') {
  const pts = [];
  let i = 0;
  let a = 0;
  let o = 0;
  const un = () => {
    let r = 0;
    let dec = 0;
    let b;
    do {
      b = s.charCodeAt(i++) - 63;
      r |= (b & 0x1f) << dec;
      dec += 5;
    } while (b >= 0x20);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  while (i < s.length) {
    a += un();
    o += un();
    pts.push([a / 1e5, o / 1e5]);
  }
  return pts;
}

/** Prépare une trace à enregistrer. */
export function nouvelleTrace({ nom, points: pts }, jour = '', couleur = COULEURS[0]) {
  return { nom, jour, couleur, km: Math.round(distanceKm(pts) * 10) / 10, trace: encoder(simplifier(pts)) };
}

/** « il y a 5 min » */
export function ilYa(iso, maintenant = Date.now()) {
  const min = Math.round((maintenant - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(min)) return '';
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `il y a ${h} h ${String(min % 60).padStart(2, '0')}` : `il y a ${Math.floor(h / 24)} j`;
}

// Exemple pour la démo : Scherwiller → Ribeauvillé → Turckheim → Colmar (tracé approximatif).
const EX = {
  'Vendredi 7 mai': [[48.2875, 7.4206], [48.2702, 7.4011], [48.2537, 7.3862], [48.2391, 7.3655], [48.2238, 7.3487], [48.2104, 7.3352], [48.1951, 7.3193]],
  'Samedi 8 mai': [[48.1951, 7.3193], [48.1788, 7.3125], [48.1622, 7.3087], [48.1447, 7.2951], [48.1265, 7.2903], [48.1083, 7.2839], [48.0872, 7.2786]],
  'Dimanche 9 mai': [[48.0872, 7.2786], [48.0851, 7.2958], [48.0832, 7.3164], [48.0815, 7.3352], [48.0819, 7.3497]],
};
export const TRACES_EXEMPLE = Object.entries(EX).map(([jour, pts], i) => ({
  id: `t${i + 1}`,
  ...nouvelleTrace({ nom: `Exemple : ${jour}`, points: pts }, jour, COULEURS[i]),
}));
export const REPERES_EXEMPLE = [
  { id: 'r1', type: 'rendez-vous', nom: 'Départ, place de la mairie', note: 'Rassemblement par chapitre.', lat: 48.2875, lng: 7.4206, jour: 'Vendredi 7 mai' },
  { id: 'r2', type: 'pique-nique', nom: 'Pique-nique du vendredi', note: '', lat: 48.2391, lng: 7.3655, jour: 'Vendredi 7 mai' },
  { id: 'r3', type: 'eau', nom: 'Fontaine', note: 'Remplir les gourdes.', lat: 48.2238, lng: 7.3487, jour: '' },
  { id: 'r4', type: 'bivouac', nom: 'Bivouac de Ribeauvillé', note: '', lat: 48.1951, lng: 7.3193, jour: 'Vendredi 7 mai' },
  { id: 'r5', type: 'secours', nom: 'Poste de secours', note: 'Voiture de la logistique.', lat: 48.1447, lng: 7.2951, jour: 'Samedi 8 mai' },
  { id: 'r6', type: 'toilettes', nom: 'Toilettes', note: '', lat: 48.1265, lng: 7.2903, jour: 'Samedi 8 mai' },
  { id: 'r7', type: 'bivouac', nom: 'Bivouac de Turckheim', note: '', lat: 48.0872, lng: 7.2786, jour: 'Samedi 8 mai' },
  { id: 'r8', type: 'eglise', nom: 'Église Saint-Joseph, grand-messe', note: '', lat: 48.0819, lng: 7.3497, jour: 'Dimanche 9 mai' },
];
