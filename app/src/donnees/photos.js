// Photos du pèlerinage : réduction sur le téléphone, puis file d'attente qui part dès qu'il y a du réseau.
// Les photos en attente sont gardées dans le téléphone (IndexedDB), même si l'app est fermée.

const LARGEUR = 2000; // grand côté de la photo envoyée (assez pour l'écran et un tirage 10x15)
const QUALITE = 0.82;
const VIGNETTE = 360;

/** Identifiant qui range les plus récentes en premier (ordre alphabétique inverse du temps). */
export const nouvelId = (t = Date.now()) =>
  (9e12 - t).toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 8).padEnd(6, '0');

/** Taille finale en gardant les proportions. */
export function dimensions(l, h, max) {
  const r = Math.min(1, max / Math.max(l, h));
  return [Math.round(l * r), Math.round(h * r)];
}

const enBase64 = (blob) =>
  new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => ko(r.error);
    r.readAsDataURL(blob);
  });

async function jpeg(image, max, qualite) {
  const [l, h] = dimensions(image.width, image.height, max);
  const c = document.createElement('canvas');
  c.width = l;
  c.height = h;
  c.getContext('2d').drawImage(image, 0, 0, l, h);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', qualite));
  if (!blob) throw new Error('Photo illisible.');
  return { base64: await enBase64(blob), largeur: l, hauteur: h };
}

/** Réduit une photo du téléphone : grande image + vignette, en JPEG. */
export async function preparer(fichier) {
  let image;
  try {
    image = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`« ${fichier.name} » n’est pas une photo lisible.`);
  }
  const grande = await jpeg(image, LARGEUR, QUALITE);
  const petite = await jpeg(image, VIGNETTE, 0.7);
  image.close?.();
  return {
    id: nouvelId(),
    base64: grande.base64,
    vignette: petite.base64,
    largeur: grande.largeur,
    hauteur: grande.hauteur,
    prise: new Date(fichier.lastModified || Date.now()).toISOString(),
  };
}

/* ---------------- File d'attente (IndexedDB) ---------------- */

const BASE = 'himmelsweg-photos';
const TABLE = 'a-envoyer';
let ouverture;
const ouvrir = () =>
  (ouverture ??= new Promise((ok, ko) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(TABLE, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  }));
async function table(mode, f) {
  const db = await ouvrir();
  return new Promise((ok, ko) => {
    const t = db.transaction(TABLE, mode);
    const req = f(t.objectStore(TABLE));
    t.oncomplete = () => ok(req?.result);
    t.onerror = () => ko(t.error);
  });
}
const tout = () => table('readonly', (s) => s.getAll());

// État visible dans l'écran : { attente: [{ id, vignette, erreur? }], envoi: bool }
let etat = { attente: [], envoi: false };
const abonnes = new Set();
const publier = (n) => {
  etat = { ...etat, ...n };
  abonnes.forEach((f) => f(etat));
};
async function relire() {
  try {
    const l = await tout();
    publier({ attente: l.map(({ id, vignette, erreur, uid }) => ({ id, vignette, erreur, uid })) });
  } catch {
    // stockage indisponible (navigation privée) : rien en attente
  }
}
export function ecouterEnvoi(cb) {
  abonnes.add(cb);
  cb(etat);
  relire();
  return () => abonnes.delete(cb);
}

/** Ajoute des photos à la file, puis tente l'envoi. */
export async function deposer(donnees, uid, fichiers) {
  const erreurs = [];
  for (const f of fichiers) {
    try {
      const p = await preparer(f);
      await table('readwrite', (s) => s.put({ ...p, uid }));
      await relire();
    } catch (e) {
      erreurs.push(e.message);
    }
  }
  envoyer(donnees, uid);
  return erreurs;
}

export async function retirerDeLaFile(id) {
  await table('readwrite', (s) => s.delete(id));
  await relire();
}

/** Envoie ce qui attend. Une erreur de réseau arrête la série : on réessaiera au retour du réseau. */
export async function envoyer(donnees, uid) {
  if (etat.envoi || !uid) return;
  publier({ envoi: true });
  try {
    for (const p of await tout()) {
      if (p.uid !== uid || p.erreur) continue; // photo d'une autre session, ou refusée
      if (!navigator.onLine) break;
      try {
        await donnees.envoyerPhoto(p);
        await table('readwrite', (s) => s.delete(p.id));
      } catch (e) {
        if (e.reseau) break;
        await table('readwrite', (s) => s.put({ ...p, erreur: e.message }));
      }
      await relire();
    }
  } catch {
    // stockage indisponible
  }
  publier({ envoi: false });
  relire();
}
