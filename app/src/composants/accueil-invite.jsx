// Accueil animé de l'ami qui ouvre un lien d'invitation : « Paul t'invite », le chemin
// Scherwiller → Colmar qui se dessine en or, puis « Je m'inscris ». Environ 5 secondes, passable.
import { useEffect, useState } from 'preact/hooks';
import logo from './logo.png';
import photo from './accueil-invite.jpg';

// Tracé approximatif (latitude, longitude), avec les quatre étapes.
const CHEMIN = [
  [48.2875, 7.4206], [48.2702, 7.4011], [48.2537, 7.3862], [48.2391, 7.3655], [48.2238, 7.3487], [48.2104, 7.3352], [48.1951, 7.3193],
  [48.1788, 7.3125], [48.1622, 7.3087], [48.1447, 7.2951], [48.1265, 7.2903], [48.1083, 7.2839], [48.0872, 7.2786],
  [48.0851, 7.2958], [48.0832, 7.3164], [48.0815, 7.3352], [48.0819, 7.3497],
];
const ETAPES = [
  { i: 0, nom: 'Scherwiller', jour: 'Vendredi 7 mai' },
  { i: 6, nom: 'Ribeauvillé', jour: 'Samedi 8 mai' },
  { i: 12, nom: 'Turckheim', jour: 'Dimanche 9 mai' },
  { i: 16, nom: 'Colmar', jour: 'Arrivée' },
];

const DEBUT_TRACE = 2.1; // secondes
const DUREE_TRACE = 2.2;

/** Points du chemin dans un cadre de 120 × 260, et part du chemin parcourue à chaque point (0 → 1). */
export function cheminDessine(points = CHEMIN, largeur = 120, hauteur = 260, marge = 10) {
  const kx = Math.cos((48.18 * Math.PI) / 180);
  const xs = points.map(([, lon]) => lon * kx);
  const ys = points.map(([lat]) => -lat);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const e = Math.min((largeur - 2 * marge) / (x1 - x0), (hauteur - 2 * marge) / (y1 - y0));
  const dx = (largeur - (x1 - x0) * e) / 2;
  const dy = (hauteur - (y1 - y0) * e) / 2;
  const pts = points.map((_, k) => [+(dx + (xs[k] - x0) * e).toFixed(1), +(dy + (ys[k] - y0) * e).toFixed(1)]);
  const cumul = [0];
  for (let k = 1; k < pts.length; k++) cumul.push(cumul[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const total = cumul.at(-1) || 1;
  return { pts, part: cumul.map((c) => c / total), d: `M${pts.map((p) => p.join(' ')).join(' L')}` };
}

export const titreInvite = (de) => (de ? `${de} t’invite` : 'Tu es invité');

export function AccueilInvite({ de, fermer }) {
  const [fini, setFini] = useState(false);
  const { pts, part, d } = cheminDessine();
  useEffect(() => {
    const t = setTimeout(() => setFini(true), (DEBUT_TRACE + DUREE_TRACE + 1.6) * 1000);
    const echap = (e) => e.key === 'Escape' && fermer();
    addEventListener('keydown', echap);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      removeEventListener('keydown', echap);
      document.body.style.overflow = '';
    };
  }, []);
  const titre = titreInvite(de);
  const mots = titre.split(' ');
  const debuts = mots.map((_, m) => mots.slice(0, m).join(' ').length + (m ? 1 : 0));

  return (
    <div class={`accueil-invite${fini ? ' fini' : ''}`} role="dialog" aria-modal="true" aria-label={`${titre} sur le chemin du Ciel`} style={{ '--photo': `url(${photo})` }}>
      <div class="ai-fond" />
      <div class="ai-etincelles" aria-hidden="true">
        {Array.from({ length: 18 }, (_, k) => (
          <i key={k} style={{ left: `${(k * 53) % 100}%`, animationDelay: `${(k * 0.37) % 4}s`, animationDuration: `${5 + (k % 5)}s` }} />
        ))}
      </div>
      <button type="button" class="ai-passer" onClick={fermer}>
        Passer
      </button>

      <div class="ai-contenu">
        <div class="ai-marque">
          <img src={logo} alt="" width="44" height="44" />
          <span>Himmelsweg</span>
        </div>
        <h1 class="ai-titre" aria-hidden="true">
          {mots.map((mot, m) => (
            <span key={m} class="ai-mot">
              {[...mot].map((l, k) => (
                <span key={k} style={{ animationDelay: `${0.5 + (debuts[m] + k) * 0.05}s` }}>
                  {l}
                </span>
              ))}
            </span>
          ))}
        </h1>
        <p class="ai-sous">sur le chemin du Ciel</p>

        <svg class="ai-carte" viewBox="0 0 300 260" aria-hidden="true">
          <g transform="translate(90 0)">
            <path class="ai-ombre" d={d} pathLength="1" />
            <path class="ai-trace" d={d} pathLength="1" style={{ animationDelay: `${DEBUT_TRACE}s`, animationDuration: `${DUREE_TRACE}s` }} />
            {ETAPES.map((e, k) => {
              const [x, y] = pts[e.i];
              const arrivee = k === ETAPES.length - 1;
              const gauche = x < 60;
              const tx = gauche ? x - 9 : x + 9;
              return (
                <g key={e.nom} class={`ai-etape${arrivee ? ' arrivee' : ''}`} style={{ animationDelay: `${DEBUT_TRACE + part[e.i] * DUREE_TRACE}s` }}>
                  <circle cx={x} cy={y} r={arrivee ? 5 : 3.6} />
                  {arrivee && <path class="ai-croix" d={`M${x} ${y - 9} v-14 M${x - 5} ${y - 18} h10`} />}
                  <text x={tx} y={y - 1} text-anchor={gauche ? 'end' : 'start'}>
                    {e.nom}
                  </text>
                  <text class="jour" x={tx} y={y + 11} text-anchor={gauche ? 'end' : 'start'}>
                    {e.jour}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <p class="ai-accroche">
          <span>Trois jours.</span> <span>Un chemin.</span> <span class="or">Et toi ?</span>
        </p>
        <button type="button" class="ai-bouton" onClick={fermer}>
          Je m’inscris
        </button>
      </div>
    </div>
  );
}
