# Script Google de l'application

Ce script relie HelloAsso, Gmail et l'app. Il tourne gratuitement sur le compte
**pelerinagehimmelsweg@gmail.com** :

- toutes les 15 minutes, il récupère les nouveaux inscrits HelloAsso et crée leur fiche dans l'app ;
- il envoie à chacun son lien personnel, au nom de **secretariat@himmelsweg.fr** ;
- quand un pèlerin ouvre son lien, il vérifie la clé et ouvre sa session.

## 1. Les formulaires d'inscription HelloAsso

Deux formulaires de type **Billetterie / Événement** : un pour les femmes, un pour les hommes.
Dans chacun, ajouter ces questions **par participant** (« Informations complémentaires »).
Le script les reconnaît aux mots en gras, l'intitulé exact peut varier.

| Question | Type | Obligatoire |
|---|---|---|
| Date de **naissance** | Date | oui |
| **Téléphone** portable | Texte | oui |
| Contact en cas d'**urgence** : **nom** | Texte | oui |
| Contact en cas d'**urgence** : **téléphone** | Texte | oui |
| Informations de **santé** à **signaler** (traitement, allergie…) | Texte | non |
| **Régime** alimentaire | Liste : Aucun, Végétarien, Sans gluten, Sans lactose, Autre | oui |
| Pour les mineurs : **nom** du **référent** adulte | Texte | non |
| Pour les mineurs : **téléphone** du **référent** | Texte | non |
| Je me propose comme **chef** de chapitre | Oui / Non | oui |
| J'**accepte** que mes informations de **santé** soient connues des responsables sécurité du pèlerinage (**consentement**) | Case à cocher | oui |

L'adresse e-mail du participant (ou à défaut celle du payeur) reçoit le lien.

## 2. La clé API HelloAsso

Sur HelloAsso : **Mon compte → Intégrations et API** → créer une clé. Garder la page ouverte :
on colle l'identifiant et le secret à l'étape 3, **jamais dans un chat ni dans le code**.

## 3. Installer le script (environ 10 minutes)

1. Sur <https://script.google.com>, connecté avec pelerinagehimmelsweg@gmail.com : **Nouveau projet**,
   nommé « App Himmelsweg ».
2. Remplacer le contenu de `Code.gs` par celui du fichier [`Code.gs`](Code.gs). Enregistrer.
3. **Paramètres du projet** (roue dentée) → **Propriétés du script** → ajouter :

   | Propriété | Valeur |
   |---|---|
   | `HELLOASSO_CLIENT_ID` | identifiant de la clé API |
   | `HELLOASSO_CLIENT_SECRET` | secret de la clé API |
   | `HELLOASSO_ORGANISATION` | `association-pour-le-culte-catholique-traditionnel-en-alsace` |
   | `FORMULAIRE_FEMMES` | fin de l'adresse du formulaire des femmes (après `/evenements/`) |
   | `FORMULAIRE_HOMMES` | fin de l'adresse du formulaire des hommes |
   | `FIREBASE_CLE` | tout le contenu du fichier JSON de la clé Firebase (le même que pour GitHub) |

4. Revenir à l'éditeur, choisir la fonction **installer**, cliquer sur **Exécuter**, accepter les autorisations.
   Le journal doit dire « Installation terminée ».
5. **Déployer → Nouveau déploiement → Application Web** : exécuter en tant que **Moi**,
   accès **Tout le monde**. Copier l'adresse qui finit par `/exec` et la donner à Claude
   (elle n'est pas secrète) : elle va dans `app/.env.production` (`VITE_SCRIPT_URL`).

## Bon à savoir

- Gmail gratuit : 100 e-mails par jour. Largement assez pour les liens au fil des inscriptions.
- Un lien perdu : dans l'app, fiche du pèlerin → « Remplacer le lien ». L'ancien cesse de marcher.
- Une inscription remboursée sur HelloAsso n'est pas importée ; si elle l'était déjà,
  la retirer à la main dans l'app.
- Tests du script (sans Google) : `node --test google/app/script.test.mjs`.
