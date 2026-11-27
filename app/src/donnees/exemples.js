// Données FICTIVES du mode démo. Aucun vrai pèlerin ici.

const H = [
  ['Antoine', 'Muller'], ['Benoît', 'Schmitt'], ['Charles', 'Klein'], ['Damien', 'Weber'],
  ['Étienne', 'Meyer'], ['François', 'Wagner'], ['Grégoire', 'Hoffmann'], ['Hugues', 'Fischer'],
  ['Jean', 'Roth'], ['Louis', 'Schneider'], ['Marc', 'Koenig'], ['Paul', 'Bauer'],
];
const F = [
  ['Anne', 'Zimmermann'], ['Bernadette', 'Kieffer'], ['Claire', 'Walter'], ['Domitille', 'Hartmann'],
  ['Élisabeth', 'Lang'], ['Françoise', 'Ott'], ['Geneviève', 'Herrmann'], ['Hélène', 'Wolff'],
  ['Isabelle', 'Simon'], ['Jeanne', 'Huber'], ['Louise', 'Becker'], ['Marie', 'Frey'],
];

export const CHAPITRES = [
  { id: 'ch-joseph', nom: 'Saint-Joseph', groupe: 'H' },
  { id: 'ch-michel', nom: 'Saint-Michel', groupe: 'H' },
  { id: 'ch-odile', nom: 'Sainte-Odile', groupe: 'F' },
  { id: 'ch-therese', nom: 'Sainte-Thérèse', groupe: 'F' },
];

const REGIMES = ['Aucun', 'Aucun', 'Aucun', 'Aucun', 'Végétarien', 'Sans gluten', 'Aucun', 'Sans lactose', 'Aucun'];
const SANTE = ['', '', 'Asthme léger, a sa ventoline', '', 'Allergie aux piqûres de guêpe', '', '', 'Genou fragile', ''];

// Petit gribouillis pour les autorisations parentales fictives.
const SIGNATURE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><path d="M20 70 C50 10 70 90 100 50 S150 20 170 60 S230 80 280 30" fill="none" stroke="#1d2a4d" stroke-width="3"/></svg>');

/** Dossier d'inscription fictif pour chaque pèlerin de démo (un par personne). */
export function dossiersExemple(membres, tarifs) {
  return membres.map((m) => {
    const montant = tarifs.find((t) => t.id === m.tarif)?.montant ?? 0;
    return {
      id: m.dossier,
      cree: `${m.inscritLe}T10:00:00Z`,
      statut: m.statut === 'inscrit' ? 'paye' : 'en_attente',
      montant,
      don: 0,
      payeur: { prenom: m.prenom, nom: m.nom, email: m.email },
      membres: [m.id],
      noms: [`${m.prenom} ${m.nom}`],
      relances: m.statut === 'inscrit' ? 0 : 1,
      liensEnvoyes: m.statut === 'inscrit',
    };
  });
}

export function membresExemple() {
  const res = [];
  const faire = (liste, groupe, chs) =>
    liste.forEach(([prenom, nom], i) => {
      const id = `m-${groupe}${i + 1}`;
      const mineur = i === 5 || i === 9;
      res.push({
        id,
        prenom,
        nom,
        groupe,
        email: `${prenom}.${nom}@exemple.fr`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
        tel: `06 ${String(10 + i).padStart(2, '0')} 2${i} 3${i} 4${i}`,
        dateNaissance: mineur ? '2010-09-1' + (i % 9) : `19${70 + i * 2}-0${(i % 9) + 1}-1${i % 9}`,
        chapitre: chs[i % 2],
        roles: ['pelerin'],
        volontaireChef: i === 2 || i === 7,
        reponses: {
          volontaireChef: i === 2 || i === 7 ? 'Oui' : 'Non',
          chorale: i % 4 === 1 ? 'Oui' : 'Non',
          ...(groupe === 'H' ? { aideLogistique: i % 3 === 0 ? 'Oui' : 'Non' } : {}),
        },
        inscritLe: `2027-0${1 + (i % 3)}-1${i % 9}`,
        statut: i === 11 ? 'en_attente' : 'inscrit',
        tarif: mineur ? 'jeune' : i === 8 ? 'soutien' : 'adulte',
        dossier: `d-${id}`,
        prive: {
          urgenceNom: `Proche de ${prenom}`,
          urgenceTel: `07 ${String(20 + i).padStart(2, '0')} 11 22 33`,
          ...(SANTE[i % SANTE.length] ? { sante: SANTE[i % SANTE.length] } : {}),
          regime: REGIMES[i % REGIMES.length],
          ...(mineur
            ? {
                referentNom: `Parent de ${prenom}`,
                referentTel: '06 99 88 77 66',
                autorisationParentale: { image: SIGNATURE, signataire: `Parent de ${prenom}`, le: '2027-01-12' },
              }
            : {}),
          consentementSante: true,
        },
      });
    });
  faire(H, 'H', ['ch-joseph', 'ch-michel']);
  faire(F, 'F', ['ch-odile', 'ch-therese']);
  const role = (id, ...r) => (res.find((m) => m.id === id).roles = ['pelerin', ...r]);
  role('m-H1', 'chef');
  role('m-H3', 'securite');
  role('m-H4', 'logistique');
  role('m-F1', 'chef');
  role('m-F3', 'securite');
  role('m-F4', 'repas');
  role('m-F5', 'repas', 'logistique');
  return res;
}

export const PERSONAS = [
  { id: 'admin-directrice', nom: 'La directrice', detail: 'Administratrice : voit et gère tout' },
  { id: 'm-F4', nom: 'Domitille', detail: 'Équipe repas' },
  { id: 'm-H4', nom: 'Damien', detail: 'Logistique : voit les fiches santé' },
  { id: 'm-H1', nom: 'Antoine', detail: 'Chef du chapitre Saint-Joseph' },
  { id: 'm-H3', nom: 'Charles', detail: 'Adjoint sécurité, Saint-Joseph' },
  { id: 'm-F2', nom: 'Bernadette', detail: 'Pèlerine' },
];

export const CONTENUS = [
  {
    id: 'c-mot',
    rubrique: 'accueil',
    periode: 'avant',
    ordre: 0,
    titre: 'Le mot de l’aumônier',
    texte: 'Merci de vous être inscrit ! Dès maintenant, confions ce pèlerinage à Notre-Dame et à sainte Odile. Texte à compléter par l’aumônier.',
  },
  {
    id: 'c-affaires',
    rubrique: 'infos',
    periode: 'avant',
    ordre: 1,
    titre: 'Liste d’affaires',
    texte:
      'Le gros sac est transporté jusqu’au bivouac. Vous ne portez que le petit sac de la journée.\n\n**Pour le bivouac**\n- 1 lampe de poche\n- 1 sac de couchage et un tapis de sol\n- 1 tente individuelle\n- Affaires de nuit et de toilette\n- Chaussures légères\n- Vêtements de rechange\n- Gamelle et couverts pour le dîner\n\n**Dans le sac de la journée**\n- 1 pique-nique pour le déjeuner\n- 1 gourde et 1 quart\n- 1 vêtement de pluie\n- 1 couvre-chef',
  },
  {
    id: 'c-horaires',
    rubrique: 'infos',
    periode: 'avant',
    ordre: 2,
    titre: 'Horaires',
    texte:
      '**Vendredi 7 mai** : Scherwiller – Ribeauvillé, environ 22 km.\n\n**Samedi 8 mai** : Ribeauvillé – Turckheim, environ 18 km.\n\n**Dimanche 9 mai** : Turckheim – Colmar, environ 6 km. Grand-messe à Saint-Joseph, puis déjeuner de clôture avec les familles.\n\n*Heures de rendez-vous précisées prochainement.*',
  },
  {
    id: 'c-transport',
    rubrique: 'infos',
    periode: 'avant',
    ordre: 3,
    titre: 'Transport',
    texte: 'Rendez-vous le vendredi matin à Scherwiller. Les informations de train et de covoiturage seront données ici.',
  },
  {
    id: 'c-spirituel',
    rubrique: 'infos',
    periode: 'avant',
    ordre: 4,
    titre: 'Préparation spirituelle',
    texte: 'Quelques pistes pour se préparer dans la prière les semaines qui précèdent le départ. Texte à compléter par l’aumônier.',
  },
  {
    id: 'c-urgence',
    rubrique: 'infos',
    periode: 'pendant',
    ordre: 1,
    titre: 'Numéros d’urgence',
    texte:
      '- Urgences : [112](tel:112)\n- SAMU : [15](tel:15)\n- Secrétariat du pèlerinage : numéro à compléter par les admins',
  },
  {
    id: 'c-chants',
    rubrique: 'prier',
    periode: 'pendant',
    ordre: 2,
    titre: 'Chants et prières',
    texte: 'Le livret de chants et les prières du pèlerinage seront disponibles ici, même sans réseau.',
  },
  {
    id: 'c-merci',
    rubrique: 'apres',
    periode: 'apres',
    ordre: 1,
    titre: 'Merci !',
    texte: 'Merci à chacun pour ces trois jours sur le chemin du Ciel. Texte à compléter par la directrice et l’aumônier.',
  },
];

// Réponses fictives au questionnaire de fin (démo). Bernadette (m-F2) n'a pas encore répondu.
const TOUCHE = [
  'La messe du dimanche à Colmar, tous ensemble après trois jours de marche.',
  'Les chants dans les vignes, le samedi matin.',
  'La fraternité dans le chapitre : on ne se connaissait pas, on repart amis.',
  'Le silence de la montée vers le Haut-Koenigsbourg.',
  'Les confessions le samedi soir, beaucoup de grâces.',
];
const IDEES = ['Un peu plus de pauses l’après-midi.', 'Des navettes pour les bagages plus tôt le matin.', 'Plus de chants appris à l’avance.', ''];
const TEMOIGNAGES = [
  'Fatigue et doutes au départ, paix et joie à l’arrivée. Merci à tous ceux qui ont rendu ces trois jours possibles.',
  'Marcher en costume alsacien vers Colmar, prier et chanter avec des centaines de jeunes : je n’oublierai jamais.',
  'J’ai trouvé un chapitre, des amies et le goût de prier. Vivement l’an prochain !',
];
export function bilanExemple(membres) {
  const bilan = [];
  const bilanFait = [];
  membres
    .filter((m) => m.statut !== 'en_attente' && m.id !== 'm-F2')
    .slice(0, 16)
    .forEach((m, i) => {
      const anonyme = i % 3 === 1;
      const n = (k) => Math.max(1, Math.min(5, 5 - ((i * k) % 3 === 0 ? 0 : (i + k) % 3)));
      const t = i % 5 === 0 ? TEMOIGNAGES[(i / 5) % TEMOIGNAGES.length] : '';
      bilanFait.push({ id: m.id, jour: '2027-05-10' });
      bilan.push({
        id: anonyme ? `b-anon-${i}` : m.id,
        jour: '2027-05-10',
        groupe: m.groupe,
        anonyme,
        ...(anonyme ? {} : { auteur: m.id, nom: `${m.prenom} ${m.nom}` }),
        reponses: {
          organisation: n(1),
          parcours: n(2),
          repas: n(4),
          chapitre: n(5),
          spirituel: 5 - (i % 7 === 3 ? 1 : 0),
          transport: n(7),
          appli: n(2),
          touche: TOUCHE[i % TOUCHE.length],
          ...(IDEES[i % IDEES.length] ? { idee: IDEES[i % IDEES.length] } : {}),
          revenir: i % 6 === 4 ? 'Peut-être' : 'Oui',
        },
        ...(t ? { temoignage: t, publier: i !== 10, signature: anonyme ? (m.groupe === 'H' ? 'Un pèlerin' : 'Une pèlerine') : `${m.prenom} ${m.nom[0]}.` } : {}),
      });
    });
  return { bilan, bilanFait };
}
