import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// L'éditeur en ligne enregistre parfois un champ vide comme "" : on le traite comme absent.
const vide = (v: unknown) => (v === '' ? null : v);
const photo = (image: any) => z.preprocess(vide, image().optional().nullable());

// Les pages du site : un fichier Markdown par page dans src/content/pages/.
// Le nom du fichier donne l'adresse de la page (ex. programme.md → /programme/).
const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional().nullable(),
      banniere: photo(image),
      position_banniere: z.string().optional().nullable(),
      photo: photo(image),
      faq: z.array(z.object({ question: z.string(), reponse: z.string().optional().nullable() })).optional().nullable(),
      etapes: z
        .array(z.object({ jour: z.string(), date: z.string().optional().nullable(), titre: z.string(), detail: z.string().optional().nullable() }))
        .optional()
        .nullable(),
      widgets: z
        .array(z.object({ titre: z.string().optional().nullable(), url: z.string().optional().nullable(), hauteur: z.preprocess(vide, z.coerce.number().optional().nullable()) }))
        .optional()
        .nullable(),
      formulaire: z.preprocess(vide, z.enum(['aucun', 'contact', 'entreprises']).optional().nullable()),
      bouton: z.object({ texte: z.string().optional().nullable(), lien: z.string().optional().nullable() }).optional().nullable(),
      partenaires: z
        .array(z.object({ nom: z.string(), logo: photo(image), lien: z.string().optional().nullable() }))
        .optional()
        .nullable(),
    }),
});

const temoin = (image: any) =>
  z.object({ texte: z.string(), nom: z.string(), role: z.string().optional().nullable(), photo: photo(image) });

const site = defineCollection({
  loader: glob({ pattern: '*.yml', base: './src/content/site' }),
  schema: ({ image }) =>
    z.union([
      // reglages.yml
      z.object({
        type: z.literal('reglages'),
        annee: z.number(),
        dates: z.string(),
        bandeau: z.string().optional().nullable(),
        email: z.string(),
        instagram: z.string().optional().nullable(),
        adresse: z.string(),
        formulaire_google: z.string().optional().nullable(),
      }),
      // menu.yml
      z.object({
        type: z.literal('menu'),
        liens: z.array(
          z.object({
            titre: z.string(),
            lien: z.string(),
            sous_menu: z.array(z.object({ titre: z.string(), lien: z.string() })).optional().nullable(),
          }),
        ),
      }),
      // accueil.yml
      z.object({
        type: z.literal('accueil'),
        image_principale: image(),
        surtitre: z.string().optional().nullable(),
        sous_titre: z.string().optional().nullable(),
        presentation_titre: z.string(),
        presentation: z.string(),
        presentation_photo: photo(image),
        temoignages_titre: z.string().optional().nullable(),
        temoignages: z.array(temoin(image)).optional().nullable(),
        encart_titre: z.string().optional().nullable(),
        encart_texte: z.string().optional().nullable(),
        encart_photo: photo(image),
        aumonerie: z.string().optional().nullable(),
        aumonerie_logo: photo(image),
      }),
    ]),
});

export const collections = { pages, site };
