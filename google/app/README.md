# Script Google de l'application

Ce script relie l'app, HelloAsso et Gmail. Il tourne gratuitement sur le compte
**pelerinagehimmelsweg@gmail.com** :

- il reçoit les inscriptions remplies sur **app.himmelsweg.fr/inscription**, revérifie les réponses
  et recalcule le prix (l'app ne peut pas le choisir), crée les fiches puis ouvre le paiement HelloAsso ;
- toutes les 15 minutes, il regarde les paiements reçus, envoie à chacun son lien personnel
  (au nom de **secretariat@himmelsweg.fr**) et relance les inscriptions non payées après 3 puis 10 jours ;
- quand un pèlerin ouvre son lien, il vérifie la clé et ouvre sa session.

Les questions, les tarifs et le règlement se modifient dans l'app : **Moi → Questionnaire et tarifs**.
Aucun formulaire n'est à créer sur HelloAsso.

## 1. La clé API HelloAsso

Sur HelloAsso : **Mon compte → Intégrations et API** → créer une clé (elle sert à créer les paiements, « Checkout »). Garder la page ouverte :
on colle l'identifiant et le secret à l'étape 2, **jamais dans un chat ni dans le code**.

## 2. Installer le script (environ 10 minutes)

1. Sur <https://script.google.com>, connecté avec pelerinagehimmelsweg@gmail.com : **Nouveau projet**,
   nommé « App Himmelsweg ».
2. Remplacer le contenu de `Code.gs` par celui du fichier [`Code.gs`](Code.gs). Enregistrer.
3. **Paramètres du projet** (roue dentée) → **Propriétés du script** → ajouter :

   | Propriété | Valeur |
   |---|---|
   | `HELLOASSO_CLIENT_ID` | identifiant de la clé API |
   | `HELLOASSO_CLIENT_SECRET` | secret de la clé API |
   | `HELLOASSO_ORGANISATION` | `association-pour-le-culte-catholique-traditionnel-en-alsace` |
   | `FIREBASE_CLE` | tout le contenu du fichier JSON de la clé Firebase (le même que pour GitHub) |

4. Revenir à l'éditeur, choisir la fonction **installer**, cliquer sur **Exécuter**, accepter les autorisations.
   Le journal doit dire « Installation terminée ».
5. **Déployer → Nouveau déploiement → Application Web** : exécuter en tant que **Moi**,
   accès **Tout le monde**. Copier l'adresse qui finit par `/exec` et la donner à Claude
   (elle n'est pas secrète) : elle va dans `app/.env.production` (`VITE_SCRIPT_URL`).

## 3. La clé GitHub, pour modifier le site depuis l'app

L'écran **Moi → Modifier le site** enregistre les textes et photos de himmelsweg.fr dans le dépôt GitHub ;
le site se met à jour tout seul en 1 à 2 minutes. Le script a besoin d'une clé limitée à ce dépôt :

1. Sur GitHub, connecté avec le compte **pelerinagehimmelsweg-creator** : photo de profil → **Settings** →
   **Developer settings** (tout en bas) → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Nom : « App Himmelsweg – site ». Expiration : la plus longue proposée (noter la date pour la renouveler).
3. **Repository access** : *Only select repositories* → **himmelsweg**.
4. **Permissions** → **Repository permissions** → **Contents** : *Read and write*. Rien d'autre.
5. **Generate token**, copier la clé (elle commence par `github_pat_`) et la coller dans les propriétés du script
   sous le nom `GITHUB_CLE`. **Jamais dans un chat ni dans le code.**

Quand la clé expire, l'écran du site l'indique : en recréer une et remplacer `GITHUB_CLE`.

## 4. Les photos du pèlerinage (dans le Drive)

Rien à régler : au premier dépôt, le script crée dans le Drive le dossier
« Himmelsweg – photos du pèlerinage », avec trois sous-dossiers : « À trier », « Galerie », « Non retenues ».
Après avoir recollé le code, lancez une fois `installer` : Google demande l'autorisation d'accéder au Drive, acceptez.
Une photo gardée dans la galerie est lisible par lien (seuls les inscrits voient ce lien, dans l'app) ; les autres restent privées.

## Bon à savoir

- Gmail gratuit : 100 e-mails par jour. Largement assez pour les liens au fil des inscriptions.
- Un lien perdu : dans l'app, fiche du pèlerin → « Remplacer le lien ». L'ancien cesse de marcher.
- Paiement par chèque ou espèces : dans l'app, **Moi → Inscriptions et paiements → Valider à la main**.
  Les liens partent dans les 15 minutes.
- Le script vérifie les inscriptions avec les mêmes règles que l'app : elles sont recopiées
  depuis `app/src/donnees/questionnaire.js` par `node google/app/copier-noyau.mjs` (un test le contrôle).
- Tests du script (sans Google) : `node --test google/app/script.test.mjs`.
