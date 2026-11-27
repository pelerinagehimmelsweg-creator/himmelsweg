// Démo de l'éditeur du site : les vrais textes du site, gardés en mémoire (rien n'est publié).
import schema from '../../../.pages.yml?raw';

const textes = import.meta.glob(['../../../site/src/content/pages/*.md', '../../../site/src/content/site/*.yml'], { query: '?raw', import: 'default', eager: true });
const photos = Object.keys(import.meta.glob('../../../site/src/assets/photos/*'));

const fichiers = new Map(Object.entries(textes).map(([k, v]) => [k.replace('../../../', ''), { contenu: v, sha: 'demo' }]));
const ajoutees = [];
let n = 0;

export const lireDemo = () => ({
  fichiers: [...fichiers].map(([chemin, f]) => ({ chemin, ...f })),
  photos: [...photos.map((p) => p.split('/').pop()), ...ajoutees],
  schema,
  demo: true,
});
export function ecrireDemo(chemin, contenu) {
  const sha = `demo-${++n}`;
  fichiers.set(chemin, { contenu, sha });
  return { sha };
}
export function photoDemo(chemin) {
  ajoutees.push(chemin.split('/').pop());
  return { chemin };
}
export function supprimerDemo(chemin) {
  fichiers.delete(chemin);
  return { ok: true };
}
