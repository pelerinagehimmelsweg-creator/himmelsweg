# Application app.himmelsweg.fr

Application du pèlerinage, installable sur téléphone et utilisable **hors ligne**.
Une seule app pour tout le monde : chacun voit ce que ses rôles lui permettent.

## L'essayer tout de suite (mode démo)

Sans réglage, l'app démarre en **mode démo** avec 24 pèlerins fictifs : on choisit une personne
(directrice, repas, logistique, chef de chapitre, adjoint sécurité, pèlerine) pour voir ce qu'elle voit.
Rien n'est envoyé nulle part : tout reste dans le navigateur.

```bash
cd app
npm install
npm run dev        # aperçu sur http://localhost:5173
```

## Ce que contient cette première version (le socle)

- Connexion : lien personnel (pèlerins et équipes), compte Google (admins).
- Onglets **Avant / Pendant / Après** : rubriques modifiables par les admins (liste d'affaires, horaires,
  transport, préparation spirituelle, numéros d'urgence, chants et prières, remerciements…).
  Bouton « Appeler les secours (112) » dans Pendant.
- **Pèlerins** (admins) : liste, recherche, filtres hommes/femmes, rôles, mineurs, volontaires chef ;
  fiche avec chapitre, rôles (plusieurs possibles), validation des chefs, lien personnel à afficher ou remplacer,
  ajout manuel.
- **Mon équipe** : le chef de chapitre et l'adjoint sécurité voient leur chapitre, la logistique voit tout le monde.
- **Moi** : boutique, don, mes informations, installation sur le téléphone, lien vers l'éditeur du site (admins).

À venir : repas, logistique, chapitres, messages et notifications, carte hors ligne, alerte accident, photos,
questionnaire, effacement automatique, liaison HelloAsso et Gmail.

## Qui voit les données sensibles

Santé, contact d'urgence, régime et référent des mineurs sont rangés à part (`membres/{id}/prive/fiche`).
La base ne les envoie qu'aux **admins**, à la **logistique**, à l'**adjoint sécurité du même chapitre** et
à la personne elle-même. Le chef de chapitre voit son chapitre sans la santé ; l'équipe repas ne voit aucune fiche.

Ces règles sont dans [`firebase/firestore.rules`](firebase/firestore.rules) et vérifiées par des tests :

```bash
npm run test:regles   # lance une base d'essai locale (Java requis) et 10 tests de droits
```

## Organisation du code

| Fichier | Rôle |
|---|---|
| `src/donnees/modele.js` | Rôles, périodes, liens, calcul de l'âge, droits affichés |
| `src/donnees/demo.js`, `exemples.js` | Mode démo et données fictives |
| `src/donnees/firebase.js` | Vraie base Firebase (hors ligne inclus) |
| `src/ecrans/` | Écrans : connexion, contenus, pèlerins, moi |
| `firebase/firestore.rules` | Règles de sécurité de la base |
| `tests/regles.test.js` | Tests des règles |

## Mise en ligne (plus tard, avec florent)

1. Créer un projet Firebase gratuit avec pelerinagehimmelsweg@gmail.com, base Firestore en Europe.
2. Copier `.env.exemple` en `.env.local` et y mettre la configuration du projet (valeurs non secrètes).
3. Ajouter un document par admin dans la collection `admins` (identifiant = adresse Gmail en minuscules).
4. Publier les règles et l'app (`firebase deploy`), puis relier `app.himmelsweg.fr` chez IONOS.
5. Le script Google (à venir) récupère les inscrits HelloAsso, envoie les liens et ouvre les sessions.
