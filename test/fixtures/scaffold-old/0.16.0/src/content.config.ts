import { defineCollection } from 'astro:content';
import { COLLECTIONS } from './content/blocks';
import { entries } from './lib/entryLoader';

/**
 * The collections this site has, read from the one place that declares them.
 *
 * `src/content/blocks.ts` says which collections exist — that file is the
 * catalogue, and the admin draws its screens from the same declaration. This
 * derives the Astro side of it rather than repeating it, so adding a collection
 * is one entry in one array and never two lists that drift.
 *
 * The reading itself is `entryLoader.ts`, and its header is where the argument
 * lives: an entry is a document of blocks now, so the prose is a string that
 * has to go through the markdown pipeline rather than a file Astro can glob.
 */
export const collections = Object.fromEntries(
  COLLECTIONS.map((collection) => [collection.name, defineCollection({ loader: entries(collection) })]),
);
