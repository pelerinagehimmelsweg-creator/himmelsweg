// Recopie le « noyau » du questionnaire (app/src/donnees/questionnaire.js) dans Code.gs,
// pour que le script Google vérifie les inscriptions avec exactement les mêmes règles que l'app.
// Lancer depuis la racine du dépôt : node google/app/copier-noyau.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const DEBUT = '// ---- NOYAU DÉBUT ----';
const FIN = '// ---- NOYAU FIN ----';
const source = new URL('../../app/src/donnees/questionnaire.js', import.meta.url);
const cible = new URL('./Code.gs', import.meta.url);

export function noyau(texte) {
  const i = texte.indexOf(DEBUT);
  const j = texte.indexOf(FIN);
  if (i === -1 || j === -1) throw new Error('Marqueurs du noyau introuvables');
  return texte.slice(i, j + FIN.length);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = readFileSync(cible, 'utf8');
  writeFileSync(cible, code.replace(noyau(code), noyau(readFileSync(source, 'utf8'))));
  console.log('Noyau recopié dans Code.gs');
}
