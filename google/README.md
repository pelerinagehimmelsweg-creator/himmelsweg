# Formulaires du site reliés au compte Google

Les formulaires Contact et Entreprises envoient leurs messages à un petit script Google
qui tourne sur le compte **pelerinagehimmelsweg@gmail.com**. Il enregistre chaque message
dans une feuille Google (dans le Drive) et envoie un e-mail depuis ce Gmail.

## Installation (une seule fois, environ 5 minutes)

1. Se connecter à Google avec **pelerinagehimmelsweg@gmail.com**.
2. Ouvrir <https://script.google.com>, cliquer sur **Nouveau projet**, le nommer « Site Himmelsweg ».
3. Effacer le contenu de `Code.gs` et coller le contenu du fichier [`Code.gs`](Code.gs) de ce dossier. Enregistrer.
4. En haut, choisir la fonction **installer** puis cliquer sur **Exécuter**. Accepter les autorisations demandées (Gmail et Sheets).
5. Cliquer sur **Déployer → Nouveau déploiement**, type **Application Web** :
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
6. Copier l'**URL de l'application Web** (elle se termine par `/exec`).
7. La coller dans `site/src/config.ts`, ligne `formulaireGoogle: ''`.

Tant que cette adresse n'est pas renseignée, le bouton « Envoyer » ouvre simplement la
messagerie du visiteur avec un e-mail pré-rempli vers secretariat@himmelsweg.fr.
