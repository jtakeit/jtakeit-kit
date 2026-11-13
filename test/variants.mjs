// The content an owner can write, at its edges — the platform's own check of a
// site's code before it is accepted (jtakeit-core backend/api/sitebuild/
// variants.mjs and pipeline.sh, step 5, JTK_E_CONTENT_VARIANT), mirrored for
// the kit's tests in contract 3's shapes:
//
//   empty   every optional field taken out, every optional list too
//   full    every optional field filled, every text as long as its field
//           allows, a row with a fresh `_key` in every empty list
//
// Required fields are left as they are, pictures and references are not
// invented, a module's settings are the module's: what no owner can write is
// not written here either. Translations keep their words, as the platform
// leaves them — but in `empty`, words for a value the original no longer
// holds go with it: the platform's lint counts them nowhere, the kit's would
// ask the page to draw them. The tree is then built and held to `jtk schema` and
// `jtkit lint`, as the platform holds it to its annotation lint: a template
// that draws a filled field nowhere — or loses its annotation on a long
// value — fails here, before a site's first build fails on staging (the
// example's /services, 13 November 2026: a `more_label` the page never drew).
//
// Keep it in step with the platform's: change one, change the other.
import { getRandomValues } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WORDS = 'Long words an owner may write, the line that wraps twice on a phone — ';
const TRANSLATION = /\.[A-Za-z]{2}(-[A-Za-z]{2})?\.json$/;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isEmpty = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

function newKey(taken) {
  for (;;) {
    const key = `k${[...getRandomValues(new Uint8Array(4))].map((one) => one.toString(16).padStart(2, '0')).join('').slice(0, 7)}`;
    if (!taken.has(key)) return key;
  }
}

function sample(field) {
  const min = typeof field.min === 'number' ? field.min : undefined;
  const max = typeof field.max === 'number' ? field.max : undefined;
  const within = (fallback) => Math.max(min ?? fallback, Math.min(max ?? fallback, fallback));
  const long = (fallback) => {
    const most = max ?? fallback;
    if (most <= 0) return undefined;
    let out = '';
    while (out.length < most) out += WORDS;
    return out.slice(0, most).trimEnd();
  };
  switch (field.kind) {
    case 'text':
      return long(80);
    case 'textarea':
    case 'richtext_lite':
    case 'markdown':
      return long(400);
    case 'tel':
      return '+41 44 000 00 00';
    case 'number':
      return within(12);
    case 'money':
      return { minor: within(125000), ...(Array.isArray(field.qualifiers) && field.qualifiers.includes('from') ? { from: true } : {}) };
    case 'duration':
      return within(90);
    case 'time_of_day':
      return within(1170);
    case 'bool':
      return true;
    case 'select': {
      const first = (field.options ?? [])[0];
      return isObject(first) ? first.value : first;
    }
    case 'email':
      return 'studio@example.com';
    case 'url':
      return 'https://example.com/a/long/address/an/owner/pasted';
    case 'date':
      return new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    default:
      // media, ref, sku and anything newer: not invented.
      return undefined;
  }
}

function vary(variant, object, fields, fresh = false) {
  for (const field of fields) {
    const required = field.required === true;
    const value = object[field.key];
    if (field.kind === 'list') {
      if (variant === 'empty' && !required) {
        delete object[field.key];
        continue;
      }
      const rows = Array.isArray(value) ? value : [];
      const made = variant === 'full' && rows.length === 0;
      if (made) rows.push({ _key: newKey(new Set(rows.map((row) => row?._key))) });
      for (const row of rows) if (isObject(row)) vary(variant, row, field.of ?? [], made);
      object[field.key] = rows;
      continue;
    }
    if (required && !fresh) continue;
    if (variant === 'empty') delete object[field.key];
    else if (isEmpty(value)) {
      const made = sample(field);
      if (made !== undefined) object[field.key] = made;
    }
  }
}

const walk = (dir) => {
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((one) => (one.isDirectory() ? (one.name === 'media' ? [] : walk(join(dir, one.name))) : one.name.endsWith('.json') ? [join(dir, one.name)] : []));
};

/**
 * Move a site's content to an edge, in place.
 * @param {string} root
 * @param {'empty' | 'full'} variant
 * @returns {number} the documents written
 */
export function varyContent(root, variant) {
  const schema = JSON.parse(readFileSync(join(root, 'jtk', 'schema.json'), 'utf8'));
  const types = new Map((schema.blocks ?? []).map((one) => [one.type, one]));
  const blocks = (list) => {
    for (const block of Array.isArray(list) ? list : []) {
      const type = isObject(block) ? types.get(block.type) : undefined;
      if (type !== undefined) vary(variant, block, type.fields ?? []);
    }
  };
  let made = 0;
  const write = (file, body) => {
    writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
    made++;
  };
  for (const file of walk(join(root, 'jtk', 'pages'))) {
    if (TRANSLATION.test(file)) continue;
    const body = JSON.parse(readFileSync(file, 'utf8'));
    blocks(body.blocks);
    write(file, body);
  }
  for (const file of walk(join(root, 'jtk', 'entries'))) {
    if (TRANSLATION.test(file)) continue;
    const body = JSON.parse(readFileSync(file, 'utf8'));
    const collection = (schema.collections ?? []).find((one) => one.name === body.collection);
    const type = types.get(collection?.type);
    if (type !== undefined) {
      if (!isObject(body.fields)) body.fields = {};
      vary(variant, body.fields, type.fields ?? []);
    }
    blocks(body.blocks);
    write(file, body);
  }
  const shared = join(root, 'jtk', 'shared.json');
  try {
    const body = JSON.parse(readFileSync(shared, 'utf8'));
    blocks(body.blocks);
    write(shared, body);
  } catch {
    // a site with no shared text
  }
  if (variant === 'empty') {
    // A translation's words for what its original no longer has: gone with it.
    const prune = (over, base) => {
      if (Array.isArray(over)) {
        return over.flatMap((row) => {
          if (!isObject(row) || row._key === undefined) return [row];
          const was = Array.isArray(base) ? base.find((one) => isObject(one) && one._key === row._key) : undefined;
          return was === undefined ? [] : [prune(row, was)];
        });
      }
      if (!isObject(over)) return over;
      const out = {};
      for (const [key, value] of Object.entries(over)) {
        if (key === '_key') out[key] = value;
        else if (isObject(base) && base[key] !== undefined) out[key] = prune(value, base[key]);
      }
      return out;
    };
    for (const file of [...walk(join(root, 'jtk', 'pages')), ...walk(join(root, 'jtk', 'entries')), ...walk(join(root, 'jtk'))].filter((one, i, all) => TRANSLATION.test(one) && all.indexOf(one) === i)) {
      const body = JSON.parse(readFileSync(file, 'utf8'));
      const original = JSON.parse(readFileSync(file.replace(TRANSLATION, '.json'), 'utf8'));
      if (Array.isArray(body.blocks)) body.blocks = prune(body.blocks, original.blocks);
      if (isObject(body.fields)) body.fields = prune(body.fields, original.fields ?? {});
      write(file, body);
    }
  }
  return made;
}

/**
 * The platform's advice on a schema that a fresh scaffold must not earn
 * (jtakeit-core backend/api/registry/advice.go): a hidden value of the owner's
 * that says neither what it belongs to nor what it does
 * (`JTK_W_HIDDEN_UNEXPLAINED`), a link the page does not show that names no
 * field (`JTK_W_LINK_NOT_BESIDE`), a date, time or price the owner cannot
 * change (`JTK_W_OWNER_LOCKED`). An entry's type is edited on its own screen
 * and is not asked.
 * @returns {string[]}
 */
export function adviceOf(schema) {
  const out = [];
  const entryTypes = new Set((schema.collections ?? []).map((one) => one.type));
  const holdsAddress = (field) => field.kind === 'url' || (field.kind === 'text' && /(^|_)(href|link|url)$/i.test(field.key));
  const locked = (owner, fields) => {
    for (const field of fields) if (field.client_editable !== true && ['date', 'time_of_day', 'money'].includes(field.kind)) out.push(`JTK_W_OWNER_LOCKED ${owner}.${field.key}`);
  };
  const links = (owner, fields) => {
    for (const field of fields) if (field.no_tap_target === true && !field.beside && holdsAddress(field)) out.push(`JTK_W_LINK_NOT_BESIDE ${owner}.${field.key}`);
  };
  for (const block of schema.blocks ?? []) {
    if (/_config$/.test(block.type)) continue;
    const owner = `blocks.${block.type}`;
    const fields = block.fields ?? [];
    locked(owner, fields);
    for (const field of fields) if (field.kind === 'list') locked(`${owner}.${field.key}`, field.of ?? []);
    if (entryTypes.has(block.type)) continue;
    links(owner, fields);
    for (const field of fields) if (field.kind === 'list') links(`${owner}.${field.key}`, field.of ?? []);
    for (const field of fields) {
      if (holdsAddress(field)) continue;
      const hint = field.hint !== undefined && field.hint !== '' && !(isObject(field.hint) && Object.keys(field.hint).length === 0);
      if (field.client_editable === true && field.no_tap_target === true && !field.beside && !hint) out.push(`JTK_W_HIDDEN_UNEXPLAINED ${owner}.${field.key}`);
    }
  }
  return out;
}
