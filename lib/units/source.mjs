/**
 * The tables of a site's TypeScript, read and edited in place: `BLOCKS`,
 * `COLLECTIONS` and `MODULES` in `src/content/blocks.ts`, `SECTIONS` and its
 * imports in `src/components/sections/index.ts` (jtakeit-core wiki/110 §3.4).
 *
 * A unit adds an element to a table and removes it again, and nothing else
 * in the file moves: every comment, every blank line and every element the
 * unit does not own stays as the developer wrote it. The element a unit owns
 * is found by what it says — a block type's `type`, a collection's `name`, a
 * map's key — never by where it sits, so a table the agent reordered or
 * added to is still edited correctly.
 *
 * Where a table is not a data literal — a spread, a call, a value made
 * elsewhere — nothing is guessed: the edit is refused with the lines to
 * change by hand, as `jtk upgrade contract-3`'s codemod refuses
 * (lib/upgrade/codemod.mjs). This reader needs no TypeScript of the site's:
 * `jtk create` runs before `npm ci`, and a scaffold's tables are literals of
 * objects, strings and numbers, which a scanner of brackets, strings and
 * comments reads exactly.
 */

/** Where each top-level bracket of a source closes, strings, templates and comments stepped over. */
function scan(source, from, open) {
  const close = { '[': ']', '{': '}', '(': ')' };
  const stack = [open];
  let at = from + 1;
  while (at < source.length && stack.length > 0) {
    const c = source[at];
    if (c === '/' && source[at + 1] === '/') {
      at = source.indexOf('\n', at);
      if (at === -1) return -1;
      continue;
    }
    if (c === '/' && source[at + 1] === '*') {
      at = source.indexOf('*/', at + 2);
      if (at === -1) return -1;
      at += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      at++;
      while (at < source.length && source[at] !== c) at += source[at] === '\\' ? 2 : 1;
      at++;
      continue;
    }
    if (c in close) stack.push(c);
    else if (c === ']' || c === '}' || c === ')') {
      if (close[stack.at(-1)] !== c) return -1;
      stack.pop();
      if (stack.length === 0) return at;
    }
    at++;
  }
  return -1;
}

/**
 * The elements of a literal between `open` and `close` (exclusive), split at
 * its top-level commas: each with the range of its own text (`start`, `end`)
 * and of the text that belongs to it — the comments and the line break before
 * it, and its comma (`from`, `to`).
 */
function elementsOf(source, open, close) {
  const out = [];
  let start = open + 1;
  let at = start;
  let depth = 0;
  const push = (end) => {
    const text = source.slice(start, end);
    if (text.trim() === '') return false;
    // The element's own text starts after its leading comments and spaces.
    let lead = 0;
    for (;;) {
      const rest = text.slice(lead);
      const space = /^\s+/.exec(rest);
      if (space) {
        lead += space[0].length;
        continue;
      }
      if (rest.startsWith('//')) {
        const line = rest.indexOf('\n');
        lead += line === -1 ? rest.length : line;
        continue;
      }
      if (rest.startsWith('/*')) {
        const shut = rest.indexOf('*/');
        lead += shut === -1 ? rest.length : shut + 2;
        continue;
      }
      break;
    }
    const own = text.slice(lead).replace(/\s+$/, '');
    if (own === '') return false;
    out.push({ from: start, start: start + lead, end: start + lead + own.length, to: end, text: own });
    return true;
  };
  while (at < close) {
    const c = source[at];
    if (c === '/' && source[at + 1] === '/') {
      at = source.indexOf('\n', at);
      continue;
    }
    if (c === '/' && source[at + 1] === '*') {
      at = source.indexOf('*/', at + 2) + 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      at++;
      while (at < close && source[at] !== c) at += source[at] === '\\' ? 2 : 1;
      at++;
      continue;
    }
    if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') depth--;
    else if (c === ',' && depth === 0) {
      // The comma is the element's.
      if (push(at)) out.at(-1).to = at + 1;
      start = at + 1;
    }
    at++;
  }
  push(close);
  if (out.length > 0 && out.at(-1).to > close) out.at(-1).to = close;
  return out;
}

/** The line a position is on, for a person. */
const lineOf = (source, at) => source.slice(0, at).split('\n').length;

/**
 * A table of a source: `export const NAME…= [ … ]` or `= { … }`.
 *
 * @returns {{ open: number; close: number; elements: { from: number; start: number; end: number; to: number; text: string }[]; line: number } | { refused: string }}
 */
export function tableIn(source, name, file = 'src/content/blocks.ts') {
  const declared = new RegExp(`^export\\s+const\\s+${name}\\b[^=]*=\\s*`, 'm').exec(source);
  if (declared === null) return { refused: `${file} declares no ${name}` };
  const open = declared.index + declared[0].length;
  const bracket = source[open];
  if (bracket !== '[' && bracket !== '{') {
    return { refused: `${file}:${lineOf(source, open)} — ${name} is not a literal (it is made by «${source.slice(open, source.indexOf('\n', open)).trim()}»): change it by hand` };
  }
  const close = scan(source, open, bracket);
  if (close === -1) return { refused: `${file}:${lineOf(source, open)} — ${name} does not close where a literal would` };
  const elements = elementsOf(source, open, close);
  const spread = elements.find((one) => one.text.startsWith('...'));
  if (spread) return { refused: `${file}:${lineOf(source, spread.start)} — ${name} spreads «${spread.text.slice(0, 40)}» into itself: a table made of another is not edited here, change it by hand` };
  return { open, close, elements, line: lineOf(source, open) };
}

/** A source with its comments taken out, strings kept as they are. */
export function uncommented(text) {
  let out = '';
  let at = 0;
  while (at < text.length) {
    const c = text[at];
    if (c === '/' && text[at + 1] === '/') {
      const end = text.indexOf('\n', at);
      at = end === -1 ? text.length : end;
      continue;
    }
    if (c === '/' && text[at + 1] === '*') {
      const end = text.indexOf('*/', at + 2);
      at = end === -1 ? text.length : end + 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      let end = at + 1;
      while (end < text.length && text[end] !== c) end += text[end] === '\\' ? 2 : 1;
      out += text.slice(at, end + 1);
      at = end + 1;
      continue;
    }
    out += c;
    at++;
  }
  return out;
}

/** What an element of an array of objects says its name is: `type: 'hero'`, `name: 'services'`. */
export function said(element, key) {
  const text = uncommented(element.text).trim();
  if (!text.startsWith('{')) return undefined;
  const inner = text.slice(1, -1);
  // Only the object's own properties: a nested object's `type` is not its.
  let depth = 0;
  let at = 0;
  let flat = '';
  while (at < inner.length) {
    const c = inner[at];
    if (c === "'" || c === '"' || c === '`') {
      let end = at + 1;
      while (end < inner.length && inner[end] !== c) end += inner[end] === '\\' ? 2 : 1;
      if (depth === 0) flat += inner.slice(at, end + 1);
      at = end + 1;
      continue;
    }
    if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') depth--;
    else if (depth === 0) flat += c;
    at++;
  }
  const found = new RegExp(`(?:^|[\\s,{])['"]?${key}['"]?\\s*:\\s*(['"])([^'"]+)\\1`).exec(flat);
  return found?.[2];
}

/** What an entry of an object literal is keyed by: `hero: Hero` → `hero`. */
export function keyOf(element) {
  return /^['"]?([A-Za-z_$][\w$-]*)['"]?\s*:/.exec(uncommented(element.text).trim())?.[1];
}

/**
 * The source with an element added to a table after the element `after`
 * finds (the first of the table where nothing is found), indented as the
 * table's elements are. Inverse of `withoutElement`.
 *
 * @param {string} text the element's text, its own comment lines included, unindented
 * @param {(element: any) => boolean} after
 */
export function withElement(source, table, text, after) {
  const { open, close, elements } = table;
  const indent = '  ';
  const body = text
    .split('\n')
    .map((line) => (line === '' ? '' : indent + line))
    .join('\n');
  let index = -1;
  elements.forEach((one, i) => {
    if (after(one)) index = i;
  });
  if (elements.length === 0) {
    // `[]` → `[\n  element,\n]`.
    const inner = source.slice(open + 1, close);
    if (inner.trim() === '') return `${source.slice(0, open + 1)}\n${body},\n${source.slice(close)}`;
  }
  const at = index === -1 ? open + 1 : elements[index].to;
  // The last element may have no comma of its own: give it one.
  const comma = index !== -1 && source[elements[index].to - 1] !== ',' ? ',' : '';
  return `${source.slice(0, at)}${comma}\n${body},${source.slice(at)}`;
}

/** The source with an element taken out, with the comments and the line it owned. */
export function withoutElement(source, element, table) {
  const out = source.slice(0, element.from) + source.slice(element.to);
  // The last one out leaves the table as it was before the first came in: `[]`.
  if (table !== undefined) {
    const close = table.close - (element.to - element.from);
    if (out.slice(table.open + 1, close).trim() === '') return out.slice(0, table.open + 1) + out.slice(close);
  }
  return out;
}
