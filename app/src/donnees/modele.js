// Vocabulaire commun à toute l'app.

export const ROLES = [
  { id: 'pelerin', nom: 'Pèlerin' },
  { id: 'repas', nom: 'Repas' },
  { id: 'logistique', nom: 'Logistique' },
  { id: 'chef', nom: 'Chef de chapitre' },
  { id: 'securite', nom: 'Adjoint sécurité' },
];

export const nomRole = (id) => ROLES.find((r) => r.id === id)?.nom ?? id;

/** Rôles liés à un chapitre : on les perd en quittant le chapitre. */
export const ROLES_DE_CHAPITRE = ['chef', 'securite'];
export const sansRolesDeChapitre = (roles) => (roles ?? []).filter((r) => !ROLES_DE_CHAPITRE.includes(r));

/** Participe à la chorale (réponse au questionnaire, modifiable par les admins). */
export const estChoriste = (m) => m?.reponses?.chorale === 'Oui';

export const GROUPES = { H: 'Hommes', F: 'Femmes' };

export const PERIODES = [
  { id: 'avant', nom: 'Avant', titre: 'Avant le pèlerinage' },
  { id: 'pendant', nom: 'Pendant', titre: 'Pendant le pèlerinage' },
  { id: 'apres', nom: 'Après', titre: 'Après le pèlerinage' },
];

export const LIENS = {
  boutique: 'https://himmelsweg.fr/boutique/',
  don: 'https://himmelsweg.fr/don/',
  site: 'https://himmelsweg.fr/',
  editeurSite: 'https://app.pagescms.org/',
};

// Date du premier jour, pour l'âge des pèlerins (mineurs de 15 à 18 ans).
export const DEBUT_PELERINAGE = '2027-05-07';

export function age(dateNaissance, auJour = DEBUT_PELERINAGE) {
  if (!dateNaissance) return null;
  const [a, m, j] = dateNaissance.split('-').map(Number);
  const [A, M, J] = auJour.split('-').map(Number);
  return A - a - (M < m || (M === m && J < j) ? 1 : 0);
}

export const estMineur = (m) => {
  const x = age(m?.dateNaissance);
  return x !== null && x < 18;
};

/**
 * Droits d'une session : qui peut voir quoi.
 * Le serveur applique les mêmes règles (firebase/firestore.rules) ;
 * ici on s'en sert seulement pour afficher ou cacher des écrans.
 */
export function droits(session) {
  const r = new Set(session?.roles ?? []);
  const admin = !!session?.estAdmin;
  return {
    admin,
    voirTousLesMembres: admin || r.has('logistique'),
    voirSanteDeTous: admin || r.has('logistique'),
    voirSanteDeSonChapitre: r.has('securite'),
    modifierContenus: admin,
  };
}

/** Petite mise en forme : paragraphes, listes à puces, **gras**, *italique*, [liens](url). */
export function enLignes(texte = '') {
  const blocs = [];
  let liste = null;
  for (const ligne of texte.split('\n')) {
    const puce = /^\s*[-*]\s+(.*)$/.exec(ligne);
    if (puce) {
      if (!liste) blocs.push((liste = { type: 'liste', items: [] }));
      liste.items.push(puce[1]);
    } else if (ligne.trim() === '') {
      liste = null;
      blocs.push({ type: 'vide' });
    } else {
      liste = null;
      const dernier = blocs.at(-1);
      if (dernier?.type === 'para') dernier.texte += ' ' + ligne.trim();
      else blocs.push({ type: 'para', texte: ligne.trim() });
    }
  }
  return blocs.filter((b) => b.type !== 'vide');
}

export function morceaux(texte) {
  const res = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((https?:\/\/[^\s)]+|tel:[^\s)]+|mailto:[^\s)]+)\)/g;
  let i = 0;
  let m;
  while ((m = re.exec(texte))) {
    if (m.index > i) res.push({ t: texte.slice(i, m.index) });
    if (m[1]) res.push({ t: m[1], gras: true });
    else if (m[2]) res.push({ t: m[2], ital: true });
    else res.push({ t: m[3], lien: m[4] });
    i = re.lastIndex;
  }
  if (i < texte.length) res.push({ t: texte.slice(i) });
  return res;
}
