import { defineCollection } from 'astro:content';
import { entries } from './lib/entryLoader';

/**
 * One collection of Astro's, for every collection of the site's.
 *
 * Which collections a site has, and which entries are in them, is
 * `jtk/catalogue.json`'s and the content's, read through the kit's door
 * (src/lib/site.ts) — not a list kept here, which would be a second answer.
 * What Astro holds is only what the door cannot make: each entry's body,
 * rendered by this site's markdown pipeline with its pictures optimised.
 * `entryLoader.ts` has the argument; `bodyOf` in src/lib/entries.ts reads it.
 */
export const collections = {
  jtk: defineCollection({ loader: entries() }),
};
