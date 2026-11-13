/**
 * The page's sections: block type → the component that draws it.
 *
 * `Blocks.astro` draws a block through its section where this map has one,
 * and as the template's plain band where it has none (src/lib/sections.ts).
 * `jtk add <section>` adds a line here and its import; `jtk remove <section>`
 * takes them out and deletes the file where it is still the scaffold's — one
 * you changed is left, and named. Write your own the same way: a component
 * that takes `{ block, page, locale, first, contact }` and annotates every
 * value through the door (`{...block.at('title')}`).
 *
 * Components only, never values: this is read once a process, and the page a
 * draft is drawn from is a request's (docs/live.md).
 */
export const SECTIONS: Record<string, unknown> = {};
