import { getEntry } from 'astro:content';
import { marked } from 'marked';

export async function reglages() {
  const e = await getEntry('site', 'reglages');
  if (!e || e.data.type !== 'reglages') throw new Error('reglages.yml manquant');
  return e.data;
}

export async function menu() {
  const e = await getEntry('site', 'menu');
  if (!e || e.data.type !== 'menu') throw new Error('menu.yml manquant');
  return e.data.liens;
}

export async function accueil() {
  const e = await getEntry('site', 'accueil');
  if (!e || e.data.type !== 'accueil') throw new Error('accueil.yml manquant');
  return e.data;
}

/** Transforme un texte mis en forme (Markdown) en HTML. */
export function html(texte?: string | null) {
  return texte ? (marked.parse(texte, { async: false }) as string) : '';
}
