/**
 * The page's sections, where the site has components of its own for them —
 * and the site's frame, where it has one.
 *
 * `jtk create` lays out an example site (jtakeit-core wiki/110): a section
 * component per block type in `src/components/sections/`, named in the
 * `SECTIONS` map of `src/components/sections/index.ts` — `{ hero: Hero,
 * values: Values, … }` — and a header, a footer and a look in
 * `src/components/site/`. `jtk add` and `jtk remove` edit that map and lay or
 * take away the files; `Blocks.astro` draws a block through its section where
 * there is one, and as the plain band it always was where there is not.
 *
 * Read with a glob, so a site without them — laid out before the example, or
 * with every section removed — builds exactly the page it built before: no
 * import names a file that is not there.
 *
 * A component, never a value: the map is read once a process, and a draft is
 * drawn per request (docs/live.md), so nothing here holds content.
 */
const maps = import.meta.glob<{ SECTIONS?: Record<string, unknown> }>('../components/sections/index.ts', { eager: true });

/** Block type → the component that draws it. Empty where the site has none. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SECTIONS: Record<string, any> = Object.values(maps)[0]?.SECTIONS ?? {};

const frame = import.meta.glob<{ default: unknown }>('../components/site/{Look,Header,Footer,Page}.astro', { eager: true });

/**
 * The site's head additions, header and footer, and how a page other than the
 * home is drawn by its sections: `src/components/site/{Look,Header,Footer,Page}.astro`,
 * each where it is.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FRAME: { Look?: any; Header?: any; Footer?: any; Page?: any } = {
  Look: frame['../components/site/Look.astro']?.default,
  Header: frame['../components/site/Header.astro']?.default,
  Footer: frame['../components/site/Footer.astro']?.default,
  Page: frame['../components/site/Page.astro']?.default,
};
