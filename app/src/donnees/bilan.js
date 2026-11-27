// Questionnaire de fin (« bilan ») : questions modifiables par les admins, réponses anonymes au choix,
// témoignage facultatif, résultats pour les admins. Module sans dépendance d'affichage (testé à part).
import { TYPES, estVide, estVisible, questionsTriees } from './questionnaire.js';

/** Ouverture automatique : dimanche 9 mai 2027, 19 h (heure de Paris). */
export const OUVERTURE_BILAN = '2027-05-09T19:00:00+02:00';
export const RELANCE_JOURS = 3;

export const TYPES_BILAN = [
  { id: 'note', nom: 'Note de 1 à 5 étoiles' },
  ...TYPES.filter((t) => ['choix', 'choix_multiples', 'oui_non', 'texte', 'texte_long', 'info'].includes(t.id)),
];

const note = (id, libelle, ordre) => ({ id, libelle, type: 'note', obligatoire: false, ordre });
export const BILAN_DEPART = [
  note('organisation', 'L’organisation générale', 10),
  note('parcours', 'Le parcours et la marche', 20),
  note('repas', 'Les repas', 30),
  note('chapitre', 'Votre chapitre et votre chef de chapitre', 40),
  note('spirituel', 'La vie spirituelle (messes, confessions, chants)', 50),
  note('transport', 'Le transport et la logistique', 60),
  note('appli', 'L’application', 70),
  { id: 'touche', libelle: 'Qu’est-ce qui vous a le plus touché ?', type: 'texte_long', obligatoire: false, ordre: 80 },
  { id: 'idee', libelle: 'Une idée pour l’an prochain ?', type: 'texte_long', obligatoire: false, ordre: 90 },
  { id: 'revenir', libelle: 'Reviendrez-vous en 2028 ?', type: 'choix', options: ['Oui', 'Peut-être', 'Non'], obligatoire: false, ordre: 100 },
];

/** Questions en service : celles des admins, sinon celles de départ. */
export const questionsBilan = (config) => questionsTriees(config?.questions?.length ? config.questions : BILAN_DEPART);

/** Le questionnaire est-il ouvert ? ouverture : 'auto' (dimanche soir), 'ouvert' ou 'ferme'. */
export function bilanOuvert(config, maintenant = Date.now()) {
  const o = config?.ouverture ?? 'auto';
  if (o === 'ouvert') return true;
  if (o === 'ferme') return false;
  return maintenant >= Date.parse(OUVERTURE_BILAN);
}

export function erreursBilan(questions, groupe, reponses) {
  const err = {};
  questions.forEach((q) => {
    if (q.type === 'info' || !estVisible(q, groupe, reponses)) return;
    const v = reponses[q.id];
    if (q.obligatoire && estVide(v)) err[q.id] = 'Réponse obligatoire.';
    else if (q.type === 'note' && !estVide(v) && ![1, 2, 3, 4, 5].includes(v)) err[q.id] = 'Note de 1 à 5.';
  });
  return err;
}

/** Ce qui part dans la base. Anonyme : ni identifiant ni nom, seulement le groupe (pèlerin ou pèlerine). */
export function reponseBilan({ questions, session, reponses, anonyme, temoignage, publier, jour }) {
  const propres = {};
  questions.forEach((q) => {
    const v = reponses[q.id];
    if (q.type !== 'info' && estVisible(q, session.groupe, reponses) && !estVide(v)) propres[q.id] = typeof v === 'string' ? v.trim().slice(0, 3000) : v;
  });
  const t = String(temoignage ?? '').trim().slice(0, 2000);
  const r = { reponses: propres, groupe: session.groupe ?? null, jour, anonyme: !!anonyme };
  if (!anonyme) {
    r.auteur = session.id;
    r.nom = `${session.prenom ?? ''} ${session.nom ?? ''}`.trim();
  }
  if (t) {
    r.temoignage = t;
    r.publier = !!publier;
    r.signature = anonyme ? (session.groupe === 'H' ? 'Un pèlerin' : 'Une pèlerine') : `${session.prenom ?? ''} ${(session.nom ?? '').slice(0, 1)}${session.nom ? '.' : ''}`.trim();
  }
  return r;
}

/** Chiffres pour l'écran des admins. */
export function resultatsBilan(questions, reponses, membres, chapitres, faits) {
  const inscrits = membres.filter((m) => m.statut !== 'en_attente' && (m.roles ?? []).length);
  const ontRepondu = new Set(faits.map((f) => f.id));
  const parChapitre = [...chapitres, { id: null, nom: 'Sans chapitre' }]
    .map((c) => {
      const l = inscrits.filter((m) => (m.chapitre ?? null) === c.id);
      return { nom: c.nom, total: l.length, repondu: l.filter((m) => ontRepondu.has(m.id)).length };
    })
    .filter((c) => c.total);
  const parQuestion = questions
    .filter((q) => q.type !== 'info')
    .map((q) => {
      const valeurs = reponses.map((r) => ({ v: r.reponses?.[q.id], r })).filter((x) => !estVide(x.v));
      if (q.type === 'note') {
        const comptes = [1, 2, 3, 4, 5].map((n) => valeurs.filter((x) => x.v === n).length);
        const n = valeurs.length;
        return { q, n, moyenne: n ? valeurs.reduce((s, x) => s + x.v, 0) / n : null, comptes };
      }
      if (['choix', 'choix_multiples', 'oui_non'].includes(q.type)) {
        const options = q.type === 'oui_non' ? ['Oui', 'Non'] : (q.options ?? []);
        const comptes = options.map((o) => valeurs.filter((x) => (Array.isArray(x.v) ? x.v.includes(o) : x.v === o)).length);
        return { q, n: valeurs.length, options, comptes };
      }
      return { q, n: valeurs.length, textes: valeurs.map((x) => ({ texte: String(x.v), qui: x.r.anonyme ? 'Anonyme' : x.r.nom || 'Pèlerin' })) };
    });
  return { inscrits: inscrits.length, repondu: inscrits.filter((m) => ontRepondu.has(m.id)).length, reponses: reponses.length, parChapitre, parQuestion };
}

const cellule = (v) => {
  const s = Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Export pour un tableur (point-virgule, comme Excel en français). */
export function csvBilan(questions, reponses) {
  const qs = questions.filter((q) => q.type !== 'info');
  const tete = ['Date', 'Nom', 'Groupe', ...qs.map((q) => q.libelle), 'Témoignage', 'Publication acceptée'];
  const lignes = reponses.map((r) => [
    r.jour,
    r.anonyme ? 'Anonyme' : r.nom,
    r.groupe === 'H' ? 'Pèlerin' : r.groupe === 'F' ? 'Pèlerine' : '',
    ...qs.map((q) => r.reponses?.[q.id]),
    r.temoignage ?? '',
    r.temoignage ? (r.publier ? 'Oui' : 'Non') : '',
  ]);
  return '﻿' + [tete, ...lignes].map((l) => l.map(cellule).join(';')).join('\r\n');
}
