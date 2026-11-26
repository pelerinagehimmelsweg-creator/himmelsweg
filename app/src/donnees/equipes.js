// Outils des équipes : repas (quantités), parcours, prévoyance, discussions, alertes.
// Fonctions sans dépendance, partagées par l'app, la démo et les tests.

export const REPAS_DEPART = [
  { id: 'diner-ven', nom: 'Dîner du vendredi' },
  { id: 'pdj-sam', nom: 'Petit-déjeuner du samedi' },
  { id: 'diner-sam', nom: 'Dîner du samedi' },
  { id: 'pdj-dim', nom: 'Petit-déjeuner du dimanche' },
];

export const UNITES = ['g', 'kg', 'cl', 'l', 'pièce'];

/** Exemples de départ : l'équipe repas les modifie. Quantité par personne et par repas. */
export const ARTICLES_DEPART = [
  { id: 'a-pates', nom: 'Pâtes', unite: 'g', parPersonne: 120, repas: ['diner-ven'], pour: '' },
  { id: 'a-pates-sg', nom: 'Pâtes sans gluten', unite: 'g', parPersonne: 120, repas: ['diner-ven'], pour: 'Sans gluten' },
  { id: 'a-pain', nom: 'Pain', unite: 'g', parPersonne: 100, repas: ['pdj-sam', 'pdj-dim'], pour: '' },
  { id: 'a-cafe', nom: 'Café moulu', unite: 'g', parPersonne: 15, repas: ['pdj-sam', 'pdj-dim'], pour: '' },
  { id: 'a-lait', nom: 'Lait', unite: 'cl', parPersonne: 20, repas: ['pdj-sam', 'pdj-dim'], pour: '' },
];

export const REPAS_CONFIG_DEPART = { repas: REPAS_DEPART, extras: 0, articles: ARTICLES_DEPART };

/** Équipes qui ont un fil de discussion. */
export const FILS = [
  { id: 'logistique', nom: 'Logistique' },
  { id: 'repas', nom: 'Repas' },
  { id: 'chef', nom: 'Chefs de chapitre' },
  { id: 'securite', nom: 'Adjoints sécurité' },
  { id: 'admins', nom: 'Admins' },
];

/** Fils auxquels une session a accès. */
export const filsDe = (session) =>
  FILS.filter((f) => (session?.estAdmin ? true : f.id !== 'admins' && (session?.roles ?? []).includes(f.id)));

/** Nombre de pèlerins par régime, sans noms : seuls les inscrits confirmés comptent. */
export function compterRegimes(membres, prives) {
  const parRegime = {};
  let total = 0;
  for (const m of membres) {
    if (m.statut === 'en_attente') continue;
    total++;
    const r = prives[m.id]?.regime || 'Non précisé';
    parRegime[r] = (parRegime[r] ?? 0) + 1;
  }
  return { total, parRegime };
}

/** Nombre de personnes concernées par un article. Les personnes en plus (encadrants…) mangent le menu normal. */
export function personnesPour(article, stats, extras = 0) {
  if (!article.pour) return (stats?.total ?? 0) + (Number(extras) || 0);
  return stats?.parRegime?.[article.pour] ?? 0;
}

/** Liste de courses : quantité totale de chaque article (par personne × personnes × nombre de repas). */
export function listeDeCourses(config, stats) {
  return (config?.articles ?? [])
    .map((a) => {
      const personnes = personnesPour(a, stats, config.extras);
      const nbRepas = (a.repas ?? []).length;
      const quantite = Math.ceil((Number(a.parPersonne) || 0) * personnes * nbRepas);
      return { ...a, personnes, nbRepas, quantite, texte: quantiteLisible(quantite, a.unite) };
    })
    .sort((x, y) => x.nom.localeCompare(y.nom, 'fr'));
}

export function quantiteLisible(q, unite) {
  const n = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  if (unite === 'g' && q >= 1000) return `${n(q / 1000)} kg`;
  if (unite === 'cl' && q >= 100) return `${n(q / 100)} l`;
  if (unite === 'pièce') return `${n(q)} pièce${q > 1 ? 's' : ''}`;
  return `${n(q)} ${unite}`;
}

/** Texte du SMS d'alerte, avec la position si on l'a. */
export function texteAlerte({ nom, chapitre, message, position }) {
  return [
    `ALERTE Himmelsweg : ${nom}${chapitre ? ` (chapitre ${chapitre})` : ''}.`,
    message || '',
    position ? `Position : https://maps.google.com/?q=${position.lat.toFixed(5)},${position.lng.toFixed(5)}` : 'Position inconnue.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Lien qui ouvre l'application SMS avec le message prêt. */
export const lienSms = (numero, texte) => `sms:${String(numero).replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(texte)}`;

export const lienCarte = (adresse) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;

export const PARCOURS_DEPART = [
  { id: 'e1', jour: 'Vendredi 7 mai', ordre: 1, heure: '', titre: 'Départ de Scherwiller', lieu: 'Scherwiller', adresse: 'Scherwiller', notes: 'Rendez-vous et heure à préciser.' },
  { id: 'e2', jour: 'Vendredi 7 mai', ordre: 2, heure: '', titre: 'Arrivée à Ribeauvillé, bivouac', lieu: 'Ribeauvillé', adresse: 'Ribeauvillé', notes: 'Environ 22 km.' },
  { id: 'e3', jour: 'Samedi 8 mai', ordre: 3, heure: '', titre: 'Ribeauvillé – Turckheim', lieu: 'Turckheim', adresse: 'Turckheim', notes: 'Environ 18 km.' },
  { id: 'e4', jour: 'Dimanche 9 mai', ordre: 4, heure: '', titre: 'Turckheim – Colmar, grand-messe à Saint-Joseph', lieu: 'Église Saint-Joseph, Colmar', adresse: 'Église Saint-Joseph, Colmar', notes: 'Environ 6 km, puis déjeuner de clôture.' },
];
