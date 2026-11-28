// Recommandation d'une entreprise : le lien personnel vers la lettre, sa lecture, et la trace gardée pour les admins.

export const LIMITES = { de: 40, a: 80, mot: 280, email: 120 };

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

/** Adresse e-mail plausible (la même règle que côté base de données). */
export const emailValide = (e: string) => e.length <= LIMITES.email && /^[^@\s]+@[^@\s]+[.][^@\s]+$/.test(e);

const PROJET = 'himmelsweg-cbd26';

/**
 * Garde la trace de la recommandation (prénom, e-mail du visiteur, entreprise, mot) dans la base de l'app,
 * où seuls les admins la lisent. Sans compte : les règles de la base n'acceptent qu'une fiche bien formée.
 */
export async function enregistrerRecommandation(r: Recommandation, email: string): Promise<boolean> {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(10)), (o) => o.toString(16).padStart(2, '0')).join('');
  const base = `projects/${PROJET}/databases/(default)/documents`;
  const texte = (v: string) => ({ stringValue: v });
  try {
    const rep = await fetch(`https://firestore.googleapis.com/v1/${base}:commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: `${base}/recommandations/${id}`,
              fields: { de: texte(r.de), email: texte(email), entreprise: texte(r.a), mot: texte(r.mot) },
            },
            currentDocument: { exists: false },
            updateTransforms: [{ fieldPath: 'date', setToServerValue: 'REQUEST_TIME' }],
          },
        ],
      }),
    });
    return rep.ok;
  } catch {
    return false;
  }
}
