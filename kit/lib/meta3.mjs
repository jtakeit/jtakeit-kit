/**
 * Contract 3's `dist/_meta.json`, as the platform's build lint reads it
 * (sitebuild/annotation-lint.mjs, `checkMeta3`, wiki/98 §6): asked by `jtkit
 * lint` and by `jtk schema`, so neither passes a file the build refuses —
 * KAIF's own writer still said contract 2's `drafts`, and `jtk schema` was
 * green over it (the KAIF move, 16 November 2026, B3).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * What the build tells the platform beside its pages, `dist/_meta.json`, in
 * the shape the platform reads it (§6) — the build's `checkMeta3`, a fault
 * to a sentence: `redirects`, `immutable` and `cache`, and nothing else. A
 * build that writes no `_meta.json` declares nothing.
 *
 * @param {string} distDir
 * @returns {string[]}
 */
export function metaFaults(distDir) {
  const file = join(distDir, '_meta.json');
  const raw = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (raw === '') return [];
  const faults = [];
  let meta;
  try {
    meta = JSON.parse(raw);
  } catch (error) {
    faults.push(`it is not JSON: ${error.message}`);
  }
  if (meta !== undefined && !isObject(meta)) faults.push('it is not an object of redirects, immutable and cache');
  if (!isObject(meta)) return faults;
  for (const key of Object.keys(meta)) {
    if (key === 'drafts') {
      faults.push(`"drafts" is contract 2's — on contract 3 which entries a visitor may not see is the platform's to say, from each entry's visible and its moments, for every build; leave it out`);
    } else if (!['redirects', 'immutable', 'cache'].includes(key)) {
      faults.push(`"${key}" is no key of it — the platform reads redirects, immutable and cache, and nothing else`);
    }
  }
  const listOf = (key) => {
    if (meta[key] === undefined) return [];
    if (Array.isArray(meta[key])) return meta[key];
    faults.push(`"${key}" is not a list`);
    return [];
  };
  listOf('redirects').forEach((one, i) => {
    if (!isObject(one) || typeof one.from !== 'string' || !one.from.startsWith('/') || typeof one.to !== 'string' || one.to === '') {
      faults.push(`redirects[${i}] is not {"from": "/an/address", "to": "<where it leads>"}`);
    } else if (one.status !== undefined && ![301, 302, 303, 307, 308].includes(one.status)) {
      faults.push(`redirects[${i}].status is ${JSON.stringify(one.status)} — a redirect's status is 301, 302, 303, 307 or 308`);
    }
  });
  listOf('immutable').forEach((one, i) => {
    if (typeof one !== 'string' || one.replace(/^\/+|\/+$/g, '') === '') {
      faults.push(`immutable[${i}] is ${JSON.stringify(one)} — a directory whose files are named by their contents, like "/_astro/", never the whole site`);
    }
  });
  const cache = listOf('cache');
  if (cache.length > 32) faults.push(`cache has ${cache.length} rules, and the edge reads the first 32`);
  cache.forEach((one, i) => {
    if (!isObject(one) || typeof one.prefix !== 'string' || one.prefix.replace(/^\/+|\/+$/g, '') === '') {
      faults.push(`cache[${i}] names no directory — {"prefix": "/clips/", "maxAge": 86400}, never the whole site`);
    } else if (typeof one.maxAge !== 'number' || !Number.isFinite(one.maxAge) || one.maxAge < 0) {
      faults.push(`cache[${i}].maxAge is ${JSON.stringify(one.maxAge)} — a number of seconds, 0 or more`);
    }
  });
  return faults;
}
