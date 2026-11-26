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

const REGIMES = ['', '', '', '', 'Végétarien', 'Sans gluten', '', 'Sans lactose', ''];
const SANTE = ['', '', 'Asthme léger, a sa ventoline', '', 'Allergie aux piqûres de guêpe', '', '', 'Genou fragile', ''];

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
        inscritLe: `2027-0${1 + (i % 3)}-1${i % 9}`,
        prive: {
          urgenceNom: `Proche de ${prenom}`,
          urgenceTel: `07 ${String(20 + i).padStart(2, '0')} 11 22 33`,
          sante: SANTE[i % SANTE.length],
          regime: REGIMES[i % REGIMES.length],
          referentNom: mineur ? `Parent de ${prenom}` : '',
          referentTel: mineur ? '06 99 88 77 66' : '',
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
    id: 'c-affaires',
    periode: 'avant',
    ordre: 1,
    titre: 'Liste d’affaires',
    texte:
      'Le gros sac est transporté jusqu’au bivouac. Vous ne portez que le petit sac de la journée.\n\n**Pour le bivouac**\n- 1 lampe de poche\n- 1 sac de couchage et un tapis de sol\n- 1 tente individuelle\n- Affaires de nuit et de toilette\n- Chaussures légères\n- Vêtements de rechange\n- Gamelle et couverts pour le dîner\n\n**Dans le sac de la journée**\n- 1 pique-nique pour le déjeuner\n- 1 gourde et 1 quart\n- 1 vêtement de pluie\n- 1 couvre-chef',
  },
  {
    id: 'c-horaires',
    periode: 'avant',
    ordre: 2,
    titre: 'Horaires',
    texte:
      '**Vendredi 7 mai** : Scherwiller – Ribeauvillé, environ 22 km.\n\n**Samedi 8 mai** : Ribeauvillé – Turckheim, environ 18 km.\n\n**Dimanche 9 mai** : Turckheim – Colmar, environ 6 km. Grand-messe à Saint-Joseph, puis déjeuner de clôture avec les familles.\n\n*Heures de rendez-vous précisées prochainement.*',
  },
  {
    id: 'c-transport',
    periode: 'avant',
    ordre: 3,
    titre: 'Transport',
    texte: 'Rendez-vous le vendredi matin à Scherwiller. Les informations de train et de covoiturage seront données ici.',
  },
  {
    id: 'c-spirituel',
    periode: 'avant',
    ordre: 4,
    titre: 'Préparation spirituelle',
    texte: 'Quelques pistes pour se préparer dans la prière les semaines qui précèdent le départ. Texte à compléter par l’aumônier.',
  },
  {
    id: 'c-urgence',
    periode: 'pendant',
    ordre: 1,
    titre: 'Numéros d’urgence',
    texte:
      '- Urgences : [112](tel:112)\n- SAMU : [15](tel:15)\n- Secrétariat du pèlerinage : numéro à compléter par les admins',
  },
  {
    id: 'c-chants',
    periode: 'pendant',
    ordre: 2,
    titre: 'Chants et prières',
    texte: 'Le livret de chants et les prières du pèlerinage seront disponibles ici, même sans réseau.',
  },
  {
    id: 'c-merci',
    periode: 'apres',
    ordre: 1,
    titre: 'Merci !',
    texte: 'Merci à chacun pour ces trois jours sur le chemin du Ciel. Texte à compléter par la directrice et l’aumônier.',
  },
  {
    id: 'c-questionnaire',
    periode: 'apres',
    ordre: 2,
    titre: 'Questionnaire de satisfaction',
    texte: 'Donnez-nous votre avis en quelques minutes. Le lien sera ajouté ici après le pèlerinage.',
  },
];
