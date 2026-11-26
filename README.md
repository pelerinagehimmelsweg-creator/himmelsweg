# Himmelsweg

Dépôt du pèlerinage Himmelsweg.

| Dossier | Contenu |
|---|---|
| `site/` | Le site public **himmelsweg.fr** |
| `app/` | L'application **app.himmelsweg.fr** (à venir) |
| `google/` | Le script Google qui reçoit les formulaires de contact |

## Modifier le site sans rien installer : Pages CMS

1. Aller sur **<https://app.pagescms.org>** et cliquer sur **Sign in with GitHub**.
2. La première fois : autoriser Pages CMS sur le dépôt `pelerinagehimmelsweg-creator/himmelsweg`.
3. Ouvrir le dépôt, branche **main**. Le menu de gauche propose :
   - **Pages** : modifier une page, ou **Add an entry** pour en créer une nouvelle. Le titre donne l'adresse de la page (« Pèlerinage des pères » → `himmelsweg.fr/pelerinage-des-peres/`).
   - **Page d'accueil** : textes, photos et témoignages de l'accueil.
   - **Menu** : ajouter une page au menu, changer l'ordre des liens.
   - **Réglages** : dates, bandeau rouge, e-mail, Instagram, adresse.
   - **Media** : ajouter ou remplacer des photos.
4. Cliquer sur **Save**. Le site est republié tout seul en 1 à 2 minutes.

Chaque page peut avoir, en plus de son texte : une grande photo en haut, une photo à côté du
texte, un bouton, des questions-réponses, les étapes d'un programme, des formulaires HelloAsso
(inscription, don, boutique) et un formulaire de contact. Tout est facultatif.

Pour annuler une modification, chaque enregistrement est gardé dans l'historique GitHub.

## Où sont les fichiers (pour information)

- Pages : `site/src/content/pages/` (un fichier par page)
- Accueil, menu, réglages : `site/src/content/site/`
- Photos : `site/src/assets/photos/` (redimensionnées automatiquement)
- Mise en page et couleurs : `site/src/layouts/`, `site/src/styles/global.css`

## Travailler sur son ordinateur (facultatif)

```bash
cd site
npm install
npm run dev     # aperçu sur http://localhost:4321
```

## Hébergement

Le site est hébergé gratuitement par **GitHub Pages** et republié automatiquement à chaque
modification de la branche `main`. Le nom de domaine reste chez IONOS.
