// Accueil animé de l'ami qui ouvre un lien d'invitation : « Paul vous invite », la carte de l'Alsace
// qui se dessine, puis le chemin Scherwiller → Colmar en rouge, et « Je m'inscris ». Style épuré.
import { useEffect, useState } from 'preact/hooks';
import logo from './logo.png';
import { ALSACE } from './alsace.js';

// Tracé approximatif (latitude, longitude), avec les quatre étapes.
export const CHEMIN = [
  [48.2875, 7.4206],
  [48.2702, 7.4011],
  [48.2537, 7.3862],
  [48.2391, 7.3655],
  [48.2238, 7.3487],
  [48.2104, 7.3352],
  [48.1951, 7.3193],
  [48.1788, 7.3125],
  [48.1622, 7.3087],
  [48.1447, 7.2951],
  [48.1265, 7.2903],
  [48.1083, 7.2839],
  [48.0872, 7.2786],
  [48.0851, 7.2958],
  [48.0832, 7.3164],
  [48.0815, 7.3352],
  [48.0819, 7.3497],
];
export const ETAPES = [
  { i: 0, nom: 'Scherwiller', jour: 'Vendredi 7 mai' },
  { i: 6, nom: 'Ribeauvillé', jour: 'Samedi 8 mai' },
  { i: 12, nom: 'Turckheim', jour: 'Dimanche 9 mai' },
  { i: 16, nom: 'Colmar', jour: 'Arrivée' },
];
const VILLES = [
  { nom: 'Strasbourg', p: [48.5734, 7.7521] },
  { nom: 'Colmar', p: [48.0794, 7.3585] },
  { nom: 'Mulhouse', p: [47.7508, 7.3359] },
];

// Cadre du dessin et projection (longitudes resserrées selon la latitude).
export const LARGEUR = 300;
export const HAUTEUR = 400;
const KX = Math.cos((48.25 * Math.PI) / 180);
export function projection(contour = ALSACE, largeur = LARGEUR, hauteur = HAUTEUR, marge = 14) {
  const xs = contour.map(([, lon]) => lon * KX);
  const ys = contour.map(([lat]) => -lat);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const e = Math.min((largeur - 2 * marge) / (x1 - x0), (hauteur - 2 * marge) / (y1 - y0));
  const dx = (largeur - (x1 - x0) * e) / 2;
  const dy = (hauteur - (y1 - y0) * e) / 2;
  return ([lat, lon]) => [+(dx + (lon * KX - x0) * e).toFixed(1), +(dy + (-lat - y0) * e).toFixed(1)];
}
const chemin = (pts) => `M${pts.map((p) => p.join(' ')).join(' L')}`;

/** Tout ce qu'il faut pour dessiner : contour, tracé, part du tracé parcourue à chaque point, cadrage du zoom. */
export function carteInvitation(zoom = 2.1) {
  const proj = projection();
  const pts = CHEMIN.map(proj);
  const cumul = [0];
  for (let k = 1; k < pts.length; k++) cumul.push(cumul[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const total = cumul.at(-1) || 1;
  // Zoom centré sur le chemin : (x, y) → (LARGEUR/2 + (x - mx) × zoom, HAUTEUR/2 + (y - my) × zoom).
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const my = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    contour: `${chemin(ALSACE.map(proj))} Z`,
    trace: chemin(pts),
    pts,
    part: cumul.map((c) => c / total),
    villes: VILLES.map((v) => ({ ...v, xy: proj(v.p) })),
    zoom: {
      echelle: zoom,
      tx: LARGEUR / 2 - mx * zoom,
      ty: HAUTEUR / 2 - my * zoom,
    },
    vers: ([x, y]) => [LARGEUR / 2 + (x - mx) * zoom, HAUTEUR / 2 + (y - my) * zoom],
  };
}

export const titreInvite = (de) => (de ? `${de} vous invite` : 'Vous êtes invité');

// Temps (secondes).
const T_CONTOUR = 1.1;
const T_ZOOM = 2.7;
const T_TRACE = 3.9;
const D_TRACE = 1.8;

/** La carte animée seule : l'Alsace se dessine, on se rapproche, le chemin se trace. decalage : secondes avant de commencer. */
export function CarteAnimee({ decalage = 0 }) {
  const [zoome, setZoome] = useState(false);
  const carte = carteInvitation();
  useEffect(() => {
    const calme = matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setZoome(true), calme ? 0 : (T_ZOOM + decalage) * 1000);
    return () => clearTimeout(t);
  }, []);
  const { echelle, tx, ty } = carte.zoom;
  return (
    <svg class={`ai-carte${zoome ? ' zoome' : ''}`} viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} aria-hidden="true">
      <g
        class="ai-zoom"
        style={{
          transform: zoome ? `translate(${tx}px, ${ty}px) scale(${echelle})` : 'none',
        }}
      >
        <path class="ai-alsace" d={carte.contour} pathLength="1" style={{ animationDelay: `${T_CONTOUR + decalage}s` }} />
        <path
          class="ai-trace"
          d={carte.trace}
          pathLength="1"
          style={{
            animationDelay: `${T_TRACE + decalage}s`,
            animationDuration: `${D_TRACE}s`,
          }}
        />
      </g>
      <g class="ai-villes" style={{ animationDelay: `${T_CONTOUR + decalage + 0.8}s` }}>
        {carte.villes.map((v) => (
          <g key={v.nom} class="ai-ville">
            <circle cx={v.xy[0]} cy={v.xy[1]} r="2.4" />
            <text x={v.xy[0] + 6} y={v.xy[1] + 3.5}>
              {v.nom}
            </text>
          </g>
        ))}
      </g>
      {ETAPES.map((e, k) => {
        const [x, y] = carte.vers(carte.pts[e.i]);
        const arrivee = k === ETAPES.length - 1;
        const gauche = x < LARGEUR / 2 - 10;
        const xt = gauche ? x - 10 : x + 10;
        return (
          <g
            key={e.nom}
            class={`ai-etape${arrivee ? ' arrivee' : ''}`}
            style={{
              animationDelay: `${T_TRACE + decalage + carte.part[e.i] * D_TRACE}s`,
            }}
          >
            <circle cx={x} cy={y} r={arrivee ? 5.5 : 4} />
            {arrivee && <path class="ai-croix" d={`M${x} ${y - 10} v-15 M${x - 5} ${y - 20} h10`} />}
            <text x={xt} y={y - 1} text-anchor={gauche ? 'end' : 'start'}>
              {e.nom}
            </text>
            <text class="jour" x={xt} y={y + 12} text-anchor={gauche ? 'end' : 'start'}>
              {e.jour}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function AccueilInvite({ de, fermer }) {
  const [fini, setFini] = useState(false);
  useEffect(() => {
    const t2 = setTimeout(() => setFini(true), (T_TRACE + D_TRACE + 1.6) * 1000);
    const echap = (e) => e.key === 'Escape' && fermer();
    addEventListener('keydown', echap);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t2);
      removeEventListener('keydown', echap);
      document.body.style.overflow = '';
    };
  }, []);
  const titre = titreInvite(de);
  const mots = titre.split(' ');
  const debuts = mots.map((_, m) => mots.slice(0, m).join(' ').length + (m ? 1 : 0));

  return (
    <div class={`accueil-invite${fini ? ' fini' : ''}`} role="dialog" aria-modal="true" aria-label={`${titre} sur le chemin du Ciel`}>
      <button type="button" class="ai-passer" onClick={fermer}>
        Passer
      </button>

      <div class="ai-contenu">
        <div class="ai-marque">
          <img src={logo} alt="" width="40" height="40" />
          <span>Himmelsweg</span>
        </div>
        <h1 class="ai-titre" aria-hidden="true">
          {mots.map((mot, m) => (
            <span key={m} class="ai-mot">
              {[...mot].map((l, k) => (
                <span
                  key={k}
                  style={{
                    animationDelay: `${0.4 + (debuts[m] + k) * 0.045}s`,
                  }}
                >
                  {l}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <p class="ai-sous">sur le chemin du Ciel</p>

        <CarteAnimee />

        <p class="ai-accroche">
          <span>Trois jours.</span> <span>Un pèlerinage.</span> <span class="rouge">Et vous ?</span>
        </p>
        <button type="button" class="ai-bouton" onClick={fermer}>
          Je m’inscris
        </button>
      </div>
    </div>
  );
}
