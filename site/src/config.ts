// ─────────────────────────────────────────────────────────────
//  Réglages du site : c'est le seul fichier à modifier
//  pour changer les dates, les liens HelloAsso, etc.
// ─────────────────────────────────────────────────────────────

export const pelerinage = {
  nom: 'Himmelsweg',
  sousTitre: 'Le Chemin du Ciel',
  annee: 2027,
  edition: 'troisième',
  dates: '7-8-9 mai 2027',
  datesLongues: 'les 7, 8 et 9 mai 2027',
};

// Bandeau rouge affiché tout en haut du site (laisser vide pour le masquer)
export const bandeau = 'Himmelsweg 2027 : rendez-vous les 7, 8 et 9 mai !';

// Liens HelloAsso. Pour les inscriptions 2027 : coller l'adresse du « widget »
// de chaque billetterie quand elle est créée sur HelloAsso.
// Tant qu'une adresse est vide, le site affiche « Inscriptions bientôt ouvertes ».
const HA = 'https://www.helloasso.com/associations/association-pour-le-culte-catholique-traditionnel-en-alsace';
export const helloasso = {
  inscriptionFemmes: '', // ex. `${HA}/evenements/himmelsweg-2027-pelerines/widget`
  inscriptionHommes: '', // ex. `${HA}/evenements/himmelsweg-2027-pelerins/widget`
  boutique: `${HA}/boutiques/boutique-himmelsweg/widget`,
  don: `${HA}/formulaires/5/widget`,
};

export const contact = {
  email: 'secretariat@himmelsweg.fr',
  instagram: 'https://www.instagram.com/himmelsweg__/',
  adresse: ['Pèlerinage Himmelsweg', '2, quai Charles Frey', '67000 Strasbourg'],
  // Adresse du script Google (voir google/README.md). Vide = le formulaire
  // ouvre la messagerie du visiteur à la place.
  formulaireGoogle: '',
};

export const menu = [
  {
    titre: 'Le pèlerinage',
    lien: '/le-pelerinage/',
    sousMenu: [
      { titre: 'Informations pratiques', lien: '/informations-pratiques/' },
      { titre: 'Programme', lien: '/programme/' },
    ],
  },
  { titre: 'Sainte Odile', lien: '/sainte-odile/' },
  { titre: 'Inscription', lien: '/inscription/' },
  { titre: 'Contact', lien: '/contact/' },
  { titre: 'Boutique', lien: '/boutique/' },
  { titre: 'Don', lien: '/don/' },
  { titre: 'Entreprises', lien: '/entreprises/' },
];
