import { under } from '../lib/under';

/**
 * {{NAME}} — the business's own facts, and the one switch that controls
 * indexability.
 *
 * Nothing here is copy. It is the data that appears in structured data, in the
 * footer, in `tel:` links, in the sitemap and in llms.txt, and it must be
 * identical everywhere it is rendered — which is why it is rendered from here
 * and never typed into a component.
 *
 * Only confirmed facts. Everything on this page is asserted to Google, and to
 * the assistants that quote it, as fact: a wrong opening hour or an invented
 * rating is worse than a missing one, and it carries the client's name.
 */

/**
 * The host this build claims, read back from the `site` option in
 * astro.config.mjs rather than written down a second time. A preview build sets
 * SITE_URL there and every canonical link follows it.
 */
export const SITE_URL = import.meta.env.SITE;

/**
 * Whether the robots meta tag, robots.txt, the sitemap and llms.txt say
 * "index me". Always: there is nothing here to decide.
 *
 * On the platform there is one kind of build, made for the site's address.
 * The preview shows the same build under `/p/<slug>/`, behind a session,
 * and the platform itself keeps it out of the index with a header; the
 * launch moves a pointer. A switch in this file that somebody flipped at
 * launch was the shape that shipped sites telling search engines to go away,
 * and a build that says noindex is refused (JTK_E_NOINDEX). The constant
 * stays so the four files that read it keep one name for one fact.
 */
export const INDEXABLE = true;

export const BUSINESS = {
  name: '{{NAME}}',

  /** One sentence: what this business is, where, for whom. */
  description: '',

  /** Address in parts. A single string is not parseable by anything. */
  street: '',
  postalCode: '',
  city: '',
  region: '',
  /** ISO 3166-1 alpha-2. */
  country: '',

  /** What a visitor reads — the form the local market recognises. */
  phoneDisplay: '',
  /** What a phone dials. E.164. Never the same string as the one above. */
  phoneDial: '',

  email: '',

  /** Every profile that is really theirs. Feeds `sameAs`. */
  instagram: '',
  facebook: '',

  /** Google's coarse bucket, e.g. '€€' or 'CHF 3–130'. Not a price list. */
  priceRange: '',

  mapsUrl: '',
} as const;

/**
 * The one query this page is for: **[service] [city]**.
 *
 * Not a keyword list. One service, named the way a customer would say it out
 * loud, and the city they would say it in. A landing page that tries to rank
 * for six things ranks for none of them, and a business with several services
 * gets one page per service later — not six phrases on this one.
 *
 * Nothing renders this. It is the target the copy is written *at*, and
 * `jt-check` reads it back to confirm that the title, the h1 and the
 * description actually serve it — a page that has to have the phrase inserted
 * to pass the check has already missed the point.
 *
 * The page still has to read as though written for a person: the query belongs
 * in sentences about this business and this person, and the moment it is
 * repeated for the crawler's benefit it is working against both audiences. See
 * `docs/pages.md` of @jtakeit/astro.
 */
export const SEARCH: {
  /** What a customer types. Their word, not the trade's. */
  service: string;
  /** The city, as a customer names it. Empty where the business is not local. */
  city: string;
  /**
   * The other forms of those two words that the copy legitimately uses.
   * Ukrainian, German and Polish all decline: «Львів» is «у Львові» in the one
   * sentence where it reads naturally, and a check that does not know that
   * would report a correctly written page as missing its city.
   */
  forms: readonly string[];
} = {
  service: '',
  city: '',
  forms: [],
};

/**
 * The narrowest schema.org type that is true — Restaurant, NailSalon, Dentist,
 * LegalService, HomeAndConstructionBusiness… A wrong narrow type is worse than
 * a correct broad one; `LocalBusiness` is always honest.
 */
export const SCHEMA_TYPE = '{{SCHEMA_TYPE}}';

/**
 * Every page of the site, written by hand rather than generated, so that adding
 * a page and forgetting to list it is a visible omission in one file instead of
 * a silent one across the build. Feeds the sitemap and llms.txt.
 */
export const PAGES: readonly { path: string; priority: number; summary: string }[] = [
  { path: '/', priority: 1.0, summary: '' },
];

export const fullAddress = [
  BUSINESS.street,
  [BUSINESS.postalCode, BUSINESS.city].filter(Boolean).join(' '),
]
  .filter(Boolean)
  .join(', ');

/**
 * The site's origin, then the path under this build's base. `SITE` already
 * carries the base on a preview build — `https://preview…/p/<slug>` — so
 * resolving `under(path)` against it wrote the slug twice, and resolving the
 * bare path against it dropped the slug. The origin is the one part of it
 * that is the same in both readings.
 */
export function canonicalFor(path: string): string {
  return new URL(under(path), new URL(SITE_URL).origin).href;
}
