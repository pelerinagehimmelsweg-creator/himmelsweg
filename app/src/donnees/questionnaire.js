// Questionnaire d'inscription : questions modifiables par les admins, tarifs, calcul du panier.
// Module sans dépendance : utilisé par l'app, la démo, les tests ET le script Google.
//
// IMPORTANT : la partie entre « NOYAU DÉBUT » et « NOYAU FIN » est recopiée telle quelle
// (sans les mots « export ») dans google/app/Code.gs, pour que le serveur vérifie les
// inscriptions exactement comme l'app. Après une modification ici, lancer
// « node google/app/copier-noyau.mjs » ; un test vérifie que les deux copies sont identiques.

// ---- NOYAU DÉBUT ----
const DEBUT = '2027-05-07';
const AGE_MINIMUM = 15;
// Réponses rangées directement sur la fiche (les autres vont dans « reponses » ou dans les infos protégées).
const CHAMPS_FICHE = ['prenom', 'nom', 'dateNaissance', 'email', 'tel'];

/** Âge au premier jour du pèlerinage. */
function ageAu(dateNaissance) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateNaissance || ''))) return null;
  const [a, m, j] = dateNaissance.split('-').map(Number);
  const [A, M, J] = DEBUT.split('-').map(Number);
  return A - a - (M < m || (M === m && J < j) ? 1 : 0);
}

/** La question s'affiche-t-elle pour cette personne ? */
function estVisible(q, groupe, reponses) {
  if (q.actif === false) return false;
  if (q.groupe && q.groupe !== 'tous' && q.groupe !== groupe) return false;
  const c = q.condition;
  if (!c || !c.type) return true;
  const a = ageAu(reponses && reponses.dateNaissance);
  if (c.type === 'mineur') return a !== null && a < 18;
  if (c.type === 'majeur') return a !== null && a >= 18;
  if (c.type === 'reponse') {
    const r = reponses ? reponses[c.question] : undefined;
    return Array.isArray(r) ? r.indexOf(c.valeur) !== -1 : String(r == null ? '' : r) === String(c.valeur == null ? '' : c.valeur);
  }
  return true;
}

function questionsTriees(questions) {
  return (questions || []).slice().sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || String(a.id).localeCompare(String(b.id)));
}

function estVide(v) {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Tarifs proposés à une personne selon son âge. */
function tarifsPour(tarifs, a) {
  return (tarifs || []).filter(
    (t) => t.actif !== false && (a === null || ((t.ageMin == null || a >= t.ageMin) && (t.ageMax == null || a <= t.ageMax))),
  );
}

/** Erreurs d'une personne : { idQuestion: message }. Vide si tout va bien. */
function erreursPersonne(questions, personne, tarifs) {
  const err = {};
  const groupe = personne.groupe;
  const reponses = personne.reponses || {};
  if (groupe !== 'H' && groupe !== 'F') err.groupe = 'Choisissez Homme ou Femme.';
  questionsTriees(questions).forEach((q) => {
    if (q.type === 'info' || !estVisible(q, groupe, reponses)) return;
    const v = reponses[q.id];
    if (q.type === 'case' && v !== true) {
      err[q.id] = 'À cocher pour continuer.';
      return;
    }
    if (q.type === 'signature' && !(v && v.image)) {
      err[q.id] = 'Signature nécessaire.';
      return;
    }
    if (q.obligatoire && estVide(v)) {
      err[q.id] = 'Réponse obligatoire.';
      return;
    }
    if (estVide(v)) return;
    if (q.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) err[q.id] = 'Adresse e-mail incorrecte.';
    if (q.type === 'telephone' && String(v).replace(/[^\d+]/g, '').length < 8) err[q.id] = 'Numéro incomplet.';
    if (q.type === 'nombre' && isNaN(Number(v))) err[q.id] = 'Nombre attendu.';
    if (q.type === 'date' && ageAu(v) === null) err[q.id] = 'Date incorrecte.';
    if (q.type === 'choix' && (q.options || []).indexOf(v) === -1) err[q.id] = 'Choix inconnu.';
    if (q.type === 'oui_non' && v !== 'Oui' && v !== 'Non') err[q.id] = 'Répondez Oui ou Non.';
  });
  const a = ageAu(reponses.dateNaissance);
  if (a !== null && (a < AGE_MINIMUM || a > 110)) {
    err.dateNaissance = a < AGE_MINIMUM ? 'Moins de ' + AGE_MINIMUM + ' ans : merci de contacter le secrétariat avant l’inscription.' : 'Date incorrecte.';
  }
  if (tarifs) {
    const t = (tarifs || []).filter((x) => x.id === personne.tarif && x.actif !== false)[0];
    if (!t) err.tarif = 'Choisissez un tarif.';
    else if (a !== null && tarifsPour([t], a).length === 0) err.tarif = 'Ce tarif ne correspond pas à l’âge indiqué.';
  }
  return err;
}

/** Total du panier, en centimes (le don est en centimes). */
function totalPanier(personnes, tarifs, don) {
  const places = personnes.reduce((s, p) => {
    const t = (tarifs || []).filter((x) => x.id === p.tarif)[0];
    return s + (t ? Number(t.montant) || 0 : 0);
  }, 0);
  return places + Math.max(0, Math.round(Number(don) || 0));
}

/**
 * Range les réponses d'une personne :
 *  - membre : fiche visible par l'équipe (nom, téléphone… et « reponses » pour les autres questions) ;
 *  - prive : informations protégées (santé, urgence, signatures…).
 * Les réponses aux questions cachées (condition non remplie) ne sont pas gardées.
 */
function versFiche(questions, groupe, reponses) {
  const membre = { groupe, reponses: {} };
  const prive = {};
  questionsTriees(questions).forEach((q) => {
    const v = reponses[q.id];
    if (q.type === 'info' || !estVisible(q, groupe, reponses) || estVide(v)) return;
    if (CHAMPS_FICHE.indexOf(q.id) !== -1) membre[q.id] = typeof v === 'string' ? v.trim() : v;
    else if (q.visibilite === 'sensible') prive[q.id] = v;
    else membre.reponses[q.id] = v;
  });
  if (membre.email) membre.email = String(membre.email).toLowerCase();
  membre.volontaireChef = membre.reponses.volontaireChef === 'Oui';
  return { membre, prive };
}
// ---- NOYAU FIN ----

export { AGE_MINIMUM, CHAMPS_FICHE, ageAu, erreursPersonne, estVide, estVisible, questionsTriees, tarifsPour, totalPanier, versFiche };

export const ageDe = (reponses) => ageAu(reponses?.dateNaissance);

/** Toutes les réponses d'une personne, à partir de sa fiche et de ses infos protégées. */
export function reponsesDe(membre, prive) {
  const r = { ...(membre?.reponses ?? {}) };
  for (const k of CHAMPS_FICHE) if (membre?.[k] != null) r[k] = membre[k];
  if (r.volontaireChef === undefined && typeof membre?.volontaireChef === 'boolean') r.volontaireChef = membre.volontaireChef ? 'Oui' : 'Non';
  if (prive && !prive.refuse) Object.assign(r, prive);
  return r;
}

/** Réponse lisible, pour les fiches. */
export function enTexte(q, v) {
  if (estVide(v)) return '—';
  if (q.type === 'case') return v ? 'Oui' : 'Non';
  if (q.type === 'signature') return v?.image ? `Signé${v.signataire ? ` par ${v.signataire}` : ''}${v.le ? ` le ${new Date(v.le).toLocaleDateString('fr-FR')}` : ''}` : '—';
  if (q.type === 'date') return new Date(`${v}T12:00:00`).toLocaleDateString('fr-FR');
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

export const TYPES = [
  { id: 'texte', nom: 'Texte court' },
  { id: 'texte_long', nom: 'Texte long' },
  { id: 'date', nom: 'Date' },
  { id: 'nombre', nom: 'Nombre' },
  { id: 'telephone', nom: 'Téléphone' },
  { id: 'email', nom: 'E-mail' },
  { id: 'oui_non', nom: 'Oui / Non' },
  { id: 'choix', nom: 'Choix dans une liste' },
  { id: 'choix_multiples', nom: 'Plusieurs choix' },
  { id: 'case', nom: 'Case à cocher obligatoire (accord)' },
  { id: 'signature', nom: 'Document à signer' },
  { id: 'info', nom: 'Texte d’information (sans réponse)' },
];
export const nomType = (id) => TYPES.find((t) => t.id === id)?.nom ?? id;

export const CONDITIONS = [
  { id: '', nom: 'Toujours' },
  { id: 'mineur', nom: 'Si la personne a moins de 18 ans' },
  { id: 'majeur', nom: 'Si la personne a 18 ans ou plus' },
  { id: 'reponse', nom: 'Selon la réponse à une autre question' },
];

export const STATUTS_DOSSIER = {
  en_attente: 'En attente de paiement',
  paye: 'Payé sur HelloAsso',
  gratuit: 'Gratuit',
  valide_main: 'Validé à la main',
  annule: 'Annulé',
};
export const dossierRegle = (statut) => ['paye', 'gratuit', 'valide_main'].includes(statut);

export const euros = (centimes) =>
  (centimes / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: centimes % 100 ? 2 : 0 });

/** Questions de départ. Les admins peuvent tout modifier ; les questions « système » ne se suppriment pas. */
export const QUESTIONS_DEPART = [
  { id: 'prenom', systeme: true, libelle: 'Prénom', type: 'texte', obligatoire: true, visibilite: 'equipe', ordre: 1 },
  { id: 'nom', systeme: true, libelle: 'Nom', type: 'texte', obligatoire: true, visibilite: 'equipe', ordre: 2 },
  { id: 'dateNaissance', systeme: true, libelle: 'Date de naissance', type: 'date', obligatoire: true, visibilite: 'equipe', ordre: 3 },
  { id: 'email', systeme: true, libelle: 'E-mail', aide: 'Le lien vers l’application sera envoyé à cette adresse. Laissez vide pour utiliser celle de la personne qui paie.', type: 'email', obligatoire: false, visibilite: 'equipe', ordre: 4 },
  { id: 'tel', systeme: true, libelle: 'Téléphone portable', type: 'telephone', obligatoire: true, visibilite: 'equipe', ordre: 5 },
  { id: 'urgenceNom', libelle: 'Contact en cas d’urgence : nom', type: 'texte', obligatoire: true, visibilite: 'sensible', ordre: 10 },
  { id: 'urgenceTel', libelle: 'Contact en cas d’urgence : téléphone', type: 'telephone', obligatoire: true, visibilite: 'sensible', ordre: 11 },
  { id: 'sante', libelle: 'Informations de santé à signaler', aide: 'Traitement, allergie, difficulté à la marche… Facultatif.', type: 'texte_long', visibilite: 'sensible', ordre: 12 },
  { id: 'regime', libelle: 'Régime alimentaire', type: 'choix', options: ['Aucun', 'Végétarien', 'Sans gluten', 'Sans lactose', 'Autre'], obligatoire: true, visibilite: 'sensible', ordre: 13 },
  { id: 'referentNom', libelle: 'Adulte référent présent sur le pèlerinage : nom', type: 'texte', obligatoire: true, visibilite: 'sensible', condition: { type: 'mineur' }, ordre: 20 },
  { id: 'referentTel', libelle: 'Adulte référent : téléphone', type: 'telephone', obligatoire: true, visibilite: 'sensible', condition: { type: 'mineur' }, ordre: 21 },
  {
    id: 'autorisationParentale',
    libelle: 'Autorisation parentale',
    texte:
      'Je soussigné(e), parent ou responsable légal, autorise mon enfant à participer au pèlerinage Himmelsweg des 7, 8 et 9 mai 2027, sous la responsabilité de l’adulte référent indiqué ci-dessus, et autorise les responsables à prendre toute mesure d’urgence nécessaire.',
    type: 'signature',
    obligatoire: true,
    visibilite: 'sensible',
    condition: { type: 'mineur' },
    ordre: 22,
  },
  { id: 'volontaireChef', systeme: true, libelle: 'Je me propose comme chef de chapitre', type: 'oui_non', obligatoire: true, visibilite: 'equipe', ordre: 30 },
  { id: 'aideLogistique', libelle: 'Je peux aider l’équipe logistique (montage, transport, installation)', type: 'oui_non', obligatoire: true, visibilite: 'equipe', groupe: 'H', ordre: 31 },
  { id: 'consentementSante', libelle: 'J’accepte que mes informations de santé soient connues des responsables sécurité du pèlerinage.', type: 'case', obligatoire: true, visibilite: 'sensible', ordre: 40 },
];

export const CONFIG_DEPART = {
  ouverte: true,
  tarifs: [
    { id: 'adulte', nom: 'Adulte', montant: 5500, ageMin: 18 },
    { id: 'jeune', nom: 'Jeune (15 à 17 ans)', montant: 3500, ageMin: 15, ageMax: 17 },
    { id: 'soutien', nom: 'Tarif de soutien', montant: 7000, ageMin: 18 },
    { id: 'religieux', nom: 'Prêtre, religieux ou religieuse', montant: 0, ageMin: 18 },
  ],
  don: true,
  reglement: 'Le règlement du pèlerinage sera publié ici par les organisateurs.',
  boutique: 'https://www.helloasso.com/associations/association-pour-le-culte-catholique-traditionnel-en-alsace/boutiques/boutique-himmelsweg',
};
