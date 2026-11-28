// Recommandation d'une entreprise : le lien personnel vers la lettre scellée, et sa lecture.

export const LIMITES = { de: 40, a: 80, mot: 280 };

const propre = (v: string | null | undefined, max: number) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

export interface Recommandation {
  de: string;
  a: string;
  mot: string;
}

/** Lit la recommandation dans l'adresse (?de=…&a=…&mot=…). */
export function lireRecommandation(params: URLSearchParams): Recommandation {
  return { de: propre(params.get('de'), LIMITES.de), a: propre(params.get('a'), LIMITES.a), mot: propre(params.get('mot'), LIMITES.mot) };
}

/** Lien personnel vers la lettre. */
export function lienLettre(origine: string, r: Recommandation): string {
  const p = new URLSearchParams();
  if (r.de) p.set('de', propre(r.de, LIMITES.de));
  if (r.a) p.set('a', propre(r.a, LIMITES.a));
  if (r.mot) p.set('mot', propre(r.mot, LIMITES.mot));
  return `${origine}/lettre/?${p}`;
}

/** Texte qui accompagne le lien dans WhatsApp, un SMS ou un e-mail. */
export function messageRecommandation(r: Recommandation, lien: string): string {
  return `Bonjour, je vous recommande le pèlerinage Himmelsweg, qui cherche le soutien d'entreprises alsaciennes. Une lettre vous attend pour ${r.a || 'votre entreprise'} : ${lien}${r.de ? `\n${r.de}` : ''}`;
}
