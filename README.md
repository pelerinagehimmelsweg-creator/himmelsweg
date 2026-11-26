# Himmelsweg

Dépôt du pèlerinage Himmelsweg.

| Dossier | Contenu |
|---|---|
| `site/` | Le site public **himmelsweg.fr** (pages, photos, inscription via HelloAsso) |
| `app/` | L'application **app.himmelsweg.fr** (à venir) |
| `google/` | Le script Google qui reçoit les formulaires de contact |

## Modifier le site

- **Dates, liens HelloAsso, bandeau, adresse e-mail** : tout est dans [`site/src/config.ts`](site/src/config.ts).
- **Textes** : un fichier par page dans [`site/src/pages/`](site/src/pages/) (`index.astro` = accueil).
- **Photos** : dans [`site/src/assets/photos/`](site/src/assets/photos/). Elles sont redimensionnées automatiquement.

Ces fichiers peuvent être modifiés directement sur GitHub (icône crayon). Dès qu'une
modification arrive sur la branche `main`, le site est republié automatiquement en 1 à 2 minutes.

## Travailler sur son ordinateur (facultatif)

```bash
cd site
npm install
npm run dev     # aperçu sur http://localhost:4321
```

## Hébergement

Le site est hébergé gratuitement par **GitHub Pages**. Le nom de domaine reste chez IONOS.
