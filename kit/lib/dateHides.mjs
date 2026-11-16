/**
 * A template that decides what is shown by comparing an entry's date with
 * today — `JTK_W_DATE_HIDES`, advice, never a refusal.
 *
 * KAIF hid a night once it was over in its own code (`nextNight()`, a
 * `filter(night => night.date >= today)` on /afisha, a client script that
 * marked a ticket over): the build froze the comparison until the next
 * build, a visitor saw a night long past, and the panel, which knew nothing
 * of it, showed the night as on the site. Contract 3 says it once, on the
 * collection — `ends_by` — and the platform works out when each entry is
 * over, says so in the panel and rebuilds at the moment; the door hands the
 * template `ended` for each entry, and `then: "hide"` takes the past ones off
 * (the owner, 16 November 2026).
 *
 * What is looked for, in the site's own code, comments left out: a
 * comparison — `<`, `<=`, `>`, `>=` — with the clock on one side and an
 * entry's date on the other (or both on one side, `Date.parse(n.date) -
 * Date.now() > 0`).
 *
 *   the clock     `new Date()`, `Date.now()`, and a name given one of them —
 *                 `const today = new Date().toISOString().slice(0, 10)`, a
 *                 parameter `now = new Date()`, `var now = Date.now()` — or a
 *                 name made from such a name (`const day = now.toISOString()…`)
 *   a date        a key of kind `date` of a collection's entry type, read as
 *                 `.date`, `['date']`, `value('date')`, or a variable of that
 *                 name (KAIF's client script read `data-date` into `date`)
 *
 * A countdown that only works out how long is left (`target - now`) compares
 * nothing and is not advised; neither is a comparison of two entries' dates
 * (a sort), nor a clock compared with something that is not a date of the
 * schema's. What it cannot see — a date compared with the clock through a
 * helper in another file, a name made two steps away — it does not guess.
 *
 * Imports nothing: `jtk schema` reads the site's files and hands them here.
 */
import { W } from './codes.mjs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** A file's code without its comments, each comment's lines kept, so a line is the file's. */
export function codeOf(source) {
  const blank = (comment) => comment.replace(/[^\n]/g, '');
  return source
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:'"`\w\\])\/\/[^\n]*/g, '$1');
}

/**
 * The words of a string literal blanked, its quotes kept: a name inside one
 * is not a name. A template literal's `${…}` stays code. A quote or a tick
 * on a line of a page's text (an apostrophe) blanks to the end of that line
 * at most.
 */
function withoutStrings(code) {
  let out = '';
  /** The open `${` of each template literal we are inside, by its depth of braces. */
  const templates = [];
  let i = 0;
  const blankTo = (end) => {
    out += code.slice(i, end).replace(/[^\n]/g, ' ');
    i = end;
  };
  const template = () => {
    // In a template literal's text, after its tick or a `}`.
    while (i < code.length) {
      const ch = code[i];
      if (ch === '\\') blankTo(Math.min(i + 2, code.length));
      else if (ch === '`') {
        out += ch;
        i += 1;
        return;
      } else if (ch === '$' && code[i + 1] === '{') {
        out += '${';
        i += 2;
        templates.push(0);
        return;
      } else blankTo(i + 1);
    }
  };
  while (i < code.length) {
    const ch = code[i];
    if (ch === "'" || ch === '"') {
      let end = i + 1;
      while (end < code.length && code[end] !== ch && code[end] !== '\n') end += code[end] === '\\' ? 2 : 1;
      out += ch;
      i += 1;
      blankTo(Math.min(end, code.length));
      if (code[i] === ch) {
        out += ch;
        i += 1;
      }
    } else if (ch === '`') {
      out += ch;
      i += 1;
      template();
    } else if (templates.length > 0 && ch === '{') {
      templates[templates.length - 1] += 1;
      out += ch;
      i += 1;
    } else if (templates.length > 0 && ch === '}') {
      out += ch;
      i += 1;
      if (templates[templates.length - 1] === 0) {
        templates.pop();
        template();
      } else templates[templates.length - 1] -= 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

const NOW = /new\s+Date\(\s*\)|Date\.now\(\s*\)/;
const escape = (word) => word.replace(/[$]/g, '\\$');
const nameIn = (name) => new RegExp(`(?<![\\w$.])${escape(name)}(?![\\w$])`);

/**
 * The names that hold the clock: given `new Date()` or `Date.now()`, or made
 * from such a name by a chain of calls on it (`now.toISOString().slice(0, 10)`,
 * `new Date(now)`, `+now`).
 */
function clockNames(code) {
  const names = new Set();
  for (const match of code.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*=\s*(?:\(\s*)*(?:new\s+Date\(\s*\)|Date\.now\(\s*\))/g)) names.add(match[1]);
  const lets = [...code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]*)/g)].map((one) => [one[1], one[2]]);
  for (let round = 0; round < 4; round += 1) {
    let more = false;
    for (const [name, init] of lets) {
      if (names.has(name)) continue;
      const head = init.replace(/^(?:\s|\(|\+|new\s+Date\(|Number\(|Math\.\w+\()*/, '');
      const first = /^([A-Za-z_$][\w$]*)(?![\w$])/.exec(head);
      if (first !== null && names.has(first[1])) {
        names.add(name);
        more = true;
      }
    }
    if (!more) break;
  }
  return names;
}

/** Where an operand of the comparison at `at` begins (going back) or ends (going on): at the expression's edge. */
function operand(code, at, step) {
  let depth = 0;
  let i = at;
  const opens = step < 0 ? ')]' : '([';
  const closes = step < 0 ? '([' : ')]';
  for (; i >= 0 && i < code.length; i += step) {
    const ch = code[i];
    if (opens.includes(ch)) depth += 1;
    else if (closes.includes(ch)) {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0) {
      if (',;{}?:\n'.includes(ch)) break;
      if (step < 0 && ch === '>' && code[i - 1] === '=') break;
      const two = step < 0 ? code.slice(i - 1, i + 1) : code.slice(i, i + 2);
      if (two === '&&' || two === '||' || two === '??') break;
      if (step < 0 && ch === '=' && !'=!<>'.includes(code[i - 1] ?? '') && code[i + 1] !== '=') break;
      if (step < 0 && /\breturn$/.test(code.slice(Math.max(0, i - 6), i + 1))) break;
    }
  }
  return step < 0 ? code.slice(i + 1, at + 1) : code.slice(at, i);
}

/**
 * The date keys a schema's collections read, each with the collections it
 * is a date of: those that do not go by it yet, and those that do.
 * @param {any} schema
 * @returns {Map<string, { open: string[]; going: string[] }>}
 */
export function dateKeysOf(schema) {
  const out = new Map();
  if (!isObject(schema)) return out;
  const blocks = Array.isArray(schema.blocks) ? schema.blocks.filter(isObject) : [];
  for (const collection of Array.isArray(schema.collections) ? schema.collections.filter(isObject) : []) {
    const type = blocks.find((one) => one.type === collection.type);
    for (const field of Array.isArray(type?.fields) ? type.fields.filter(isObject) : []) {
      if (field.kind !== 'date' || typeof field.key !== 'string' || !/^[a-z][a-z0-9_]*$/.test(field.key)) continue;
      const one = out.get(field.key) ?? { open: [], going: [] };
      const goes = isObject(collection.ends_by) && collection.ends_by.date === field.key;
      (goes ? one.going : one.open).push(String(collection.name));
      out.set(field.key, one);
    }
  }
  return out;
}

/**
 * Every place a file compares an entry's date with the clock.
 *
 * @param {string} source the file as written
 * @param {Map<string, { open: string[]; going: string[] }>} keys `dateKeysOf(schema)`
 * @returns {{ line: number; key: string; said: string }[]}
 */
export function datesAgainstClock(source, keys) {
  if (keys.size === 0) return [];
  const code = withoutStrings(codeOf(source));
  const quoted = codeOf(source);
  const clocks = [...clockNames(code)].map(nameIn);
  const hasClock = (side) => NOW.test(side) || clocks.some((re) => re.test(side));
  const dateIn = (side, raw) => {
    for (const key of keys.keys()) {
      if (new RegExp(`\\.${key}(?![\\w$])(?!\\s*\\()`).test(side)) return key;
      if (new RegExp(`[\\[(]\\s*['"\`]${key}['"\`]\\s*[\\])]`).test(raw)) return key;
      if (nameIn(key).test(side)) return key;
    }
    return undefined;
  };
  const out = [];
  const seen = new Set();
  for (const match of code.matchAll(/\s(<=|>=|<|>)\s/g)) {
    const before = match.index;
    const after = match.index + match[0].length;
    const left = operand(code, before, -1);
    const right = operand(code, after, 1);
    const leftRaw = quoted.slice(before - left.length + 1, before + 1);
    const rightRaw = quoted.slice(after, after + right.length);
    let key;
    const [lc, rc] = [hasClock(left), hasClock(right)];
    const [ld, rd] = [dateIn(left, leftRaw), dateIn(right, rightRaw)];
    if (lc && rd !== undefined) key = rd;
    else if (rc && ld !== undefined) key = ld;
    else if (lc && ld !== undefined) key = ld;
    else if (rc && rd !== undefined) key = rd;
    if (key === undefined) continue;
    const line = code.slice(0, match.index).split('\n').length;
    if (seen.has(line)) continue;
    seen.add(line);
    const said = `${leftRaw.trim()} ${match[1]} ${rightRaw.trim()}`.replace(/\s+/g, ' ');
    out.push({ line, key, said: said.length > 80 ? `${said.slice(0, 77)}…` : said });
  }
  return out;
}

/** The files of a site's code a template may compare in, by extension. */
export const CODE_FILE = /\.(astro|[cm]?[jt]sx?|svelte|vue)$/;

/**
 * The advice, one finding a place: `{ code, path, says }`, `path` the file
 * and its line.
 *
 * @param {Record<string, string>} files the site's code by its path from the root (`src/pages/afisha.astro`)
 * @param {any} schema the contract-3 schema, as `jtk/schema.json` holds it
 */
export function dateHides(files, schema) {
  const keys = dateKeysOf(schema);
  const out = [];
  for (const [path, source] of Object.entries(files)) {
    if (!CODE_FILE.test(path) || path.endsWith('.d.ts')) continue;
    for (const one of datesAgainstClock(source, keys)) {
      const { open, going } = keys.get(one.key);
      const names = (list) => list.map((name) => `"${name}"`).join(' or ');
      const says =
        open.length > 0
          ? `\`${one.said}\` compares an entry's date (${one.key}) with the clock to choose what is shown — a build freezes that comparison until the next build, a visitor sees what is over as ahead and the panel cannot know. ` +
            `Declare ends_by on ${names(open)} ("ends_by": {"date": "${one.key}", "zone": "Europe/Zurich", "then": "keep"} — "keep" to keep past ones as an archive, "hide" to take them off; a time and "after" where it ends later) and read \`ended\` from the entries the door gives (site.entries(${JSON.stringify(open[0])}))`
          : `\`${one.said}\` compares an entry's date (${one.key}) with the clock, and ${names(going)} is over by that date already (ends_by): the platform rebuilds at the moment — read \`ended\` from the entries the door gives and drop the comparison, which a build freezes`;
      out.push({ code: W.DATE_HIDES, path: `${path}:${one.line}`, says });
    }
  }
  return out;
}
