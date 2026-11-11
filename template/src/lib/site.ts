/**
 * This site's content, read through the kit's door — and the one place it is.
 *
 *   import { site } from '../lib/site';
 *   const prices = site.page('/prices', locale);
 *   const rates = prices.block('rates');
 *   <h2 {...rates.at('title')}>{rates.text('title')}</h2>
 *
 * ── why nothing in this repository reads `jtk/` itself ──────────────────────
 *
 * Every file under `jtk/` is the platform's contract: which page is which,
 * which entries a collection has and in what order, which language a document
 * is in, what the owner may tap and what path the tap writes to. Read by code
 * in this repository, each of those rules was frozen the day the site was
 * laid out — the scaffold read a page by its path and the home by its file
 * name, an entry by where its file sat while the platform knew it by its
 * path, and every gallery in a post as `work`. No release of the kit could
 * reach a site that read its content itself (9 November 2026).
 *
 * So the reading is `@jtakeit/kit/content`'s, and a kit bump changes it. What
 * stays here is this site's own: its components, its words (`src/copy`), its
 * markdown pipeline and how a picture becomes an asset.
 *
 * ── the line that supplies the files ────────────────────────────────────────
 *
 * Eager, because a page is read while its route renders and there is nothing
 * to wait for; a glob, because the door is handed every file and decides
 * which are content — and because under `astro dev` Vite reloads this module,
 * and every page that reads it, when one of them changes. The line stays the
 * same when the layout of `jtk/` changes in a later contract.
 *
 * The schema is `jtk/catalogue.json`, the file `npx @jtakeit/astro catalogue`
 * writes from `src/content/blocks.ts`: what the platform reads is what the
 * site renders from. The dev server writes it again whenever `blocks.ts` is
 * saved (jtakeit-meta.mjs); before a commit, run the tool — a build reads the
 * committed file.
 *
 * ── the currency is the site's, and only here ───────────────────────────────
 *
 * `site.money(value, locale)` says a price in the currency of `jtk/site.json`
 * — what the diary prices in, what Stripe charges in, what the panel shows —
 * and `site.currency` is that code for a component that needs it. The agent
 * gives it once, while the site has none (`create_site`'s `currency`, or
 * contract 3's `currency` at the top of `jtk/site.json`, which the next import
 * takes); after that a person changes it in the panel and the platform's save
 * writes it there. A page never names a currency of its own: a literal «CHF»
 * went on saying francs after the business changed its currency in the panel
 * (11 October 2026), and the platform's preflight looks for exactly that.
 *
 * `PUBLIC_JTK_ANNOTATE=false` writes no annotation anywhere — a build with no
 * editor carries no trace of one.
 */
import { content } from '@jtakeit/kit/content';

export const site = content(import.meta.glob('/jtk/**/*.json', { eager: true, import: 'default' }), {
  annotate: import.meta.env.PUBLIC_JTK_ANNOTATE !== 'false',
});
