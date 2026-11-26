/**
 * Formulaires du site himmelsweg.fr (Contact et Entreprises).
 *
 * Ce script tourne sur le compte Google du pèlerinage. Pour chaque message :
 *  1. il ajoute une ligne dans la feuille Google « Messages du site » (dans Drive) ;
 *  2. il envoie un e-mail depuis ce Gmail vers l'adresse DESTINATAIRE,
 *     avec « Répondre à » réglé sur l'adresse du visiteur.
 *
 * Installation : voir google/README.md.
 */

const DESTINATAIRE = 'secretariat@himmelsweg.fr';
const NOM_FEUILLE = 'Messages du site';

function doPost(e) {
  const p = e.parameter || {};
  if (p.site_web) return reponse_('ignoré'); // robot anti-spam
  const email = String(p.email || '').trim();
  const message = String(p.message || '').trim();
  if (!email || !message || message.length > 10000) return reponse_('invalide');

  const sujet = String(p.sujet || 'Contact').slice(0, 50);
  const nom = String(p.nom || '').slice(0, 200);
  const aides = (e.parameters && e.parameters.aide ? e.parameters.aide : []).join(', ');

  feuille_().appendRow([new Date(), sujet, nom, email, aides, message]);

  const corps = [
    `Nouveau message depuis le site (${sujet})`,
    '',
    `Nom : ${nom || '—'}`,
    `E-mail : ${email}`,
    aides ? `Aide proposée : ${aides}` : '',
    '',
    message,
  ].filter((l) => l !== null).join('\n');

  GmailApp.sendEmail(DESTINATAIRE, `Site Himmelsweg – ${sujet} – ${nom || email}`, corps, {
    replyTo: email,
    name: 'Site Himmelsweg',
  });
  return reponse_('ok');
}

function feuille_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('FEUILLE_ID');
  let classeur;
  if (id) {
    classeur = SpreadsheetApp.openById(id);
  } else {
    classeur = SpreadsheetApp.create(NOM_FEUILLE);
    classeur.getSheets()[0].appendRow(['Date', 'Formulaire', 'Nom', 'E-mail', 'Aide proposée', 'Message']);
    props.setProperty('FEUILLE_ID', classeur.getId());
  }
  return classeur.getSheets()[0];
}

function reponse_(statut) {
  return ContentService.createTextOutput(JSON.stringify({ statut })).setMimeType(ContentService.MimeType.JSON);
}

/** À lancer une fois à la main pour accorder les autorisations et créer la feuille. */
function installer() {
  feuille_();
  Logger.log('Feuille prête : ' + SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('FEUILLE_ID')).getUrl());
}
