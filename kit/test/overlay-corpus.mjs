// The fixture corpus of the merge of an original and its translation
// (jtakeit-core wiki/98 §1, 3): one case per file, in the format the
// platform's corpus (backend/api/sites/testdata/overlays/) is written in —
//
//   { "name", "schema", "base", "translation", "locale", "merged", "fromBase", "outdated", "advice", "refused" }
//
// `merged` is the document served in `locale`; `fromBase` the places whose
// values are the original's, in any order; `outdated` the places the
// translation made from an original changed since; `advice` the codes of
// what the judge advises, one for each; `refused` `null`, or the code the
// judge refuses the translation with — and then `merged` is still what a
// reader serves (it reads past what the judge refuses: a shared value is the
// original's), as the platform's runner holds it. `outdated` and `advice`
// are compared where a case has them. Read by
// test/overlays.test.mjs on the kit's own cases and on any directory JTK_OVERLAYS names, and by the
// repository's scripts/overlays.mjs on the platform's.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { mergeDocument } from '../lib/content/overlay.mjs';
import { canonicalJSON, judgeTranslation, outdatedIn } from '../lib/translations.mjs';

/**
 * Every case of a directory, or of one file: a file holds one case, a list
 * of them, or `{ "cases": [...] }`.
 * @param {string} at
 * @returns {{ file: string; case: any }[]}
 */
export function readCases(at) {
  const files = statSync(at).isDirectory()
    ? readdirSync(at).filter((name) => name.endsWith('.json')).sort().map((name) => join(at, name))
    : [at];
  return files.flatMap((file) => casesIn(file, JSON.parse(readFileSync(file, 'utf8'))));
}

/** The cases a file's JSON holds. */
export function casesIn(file, json) {
  const list = Array.isArray(json) ? json : Array.isArray(json?.cases) ? json.cases : [json];
  return list.map((one) => ({ file, case: one }));
}

/**
 * Where the kit's merge and judge part from one case: nothing where they agree.
 * @param {any} one
 * @returns {string[]}
 */
export function sitCase(one) {
  const out = [];
  for (const key of ['name', 'schema', 'base', 'locale']) if (one?.[key] === undefined) out.push(`the case has no "${key}"`);
  if (out.length > 0) return out;
  const translation = one.translation ?? null;
  const findings = translation === null ? [] : judgeTranslation(one.schema, one.base, translation);
  const refusal = findings.find((finding) => finding.code.startsWith('JTK_E_'));
  const ours = refusal?.code ?? null;
  const theirs = one.refused ?? null;
  if (ours !== theirs) {
    out.push(`refused: the case says ${theirs === null ? 'nothing' : theirs}, the kit ${ours === null ? 'nothing' : `${ours} (${refusal.path}: ${refusal.says})`}`);
  }
  const { merged, fromBase } = mergeDocument(one.schema, one.base, translation);
  if (canonicalJSON(merged ?? null) !== canonicalJSON(one.merged ?? null)) {
    out.push(`merged: the case says ${canonicalJSON(one.merged ?? null)}\n          the kit says  ${canonicalJSON(merged ?? null)}`);
  }
  const only = (a, b) => a.filter((place) => !b.includes(place));
  const compare = (what, said, ours) => {
    const want = [...new Set(Array.isArray(said) ? said : [])].sort();
    const got = [...new Set(ours)].sort();
    if (only(want, got).length > 0 || only(got, want).length > 0) {
      out.push(`${what}: only the case says [${only(want, got).join(', ')}], only the kit says [${only(got, want).join(', ')}]`);
    }
  };
  compare('fromBase', one.fromBase, fromBase);
  if (one.outdated !== undefined) compare('outdated', one.outdated, outdatedIn(one.schema, one.base, translation));
  if (one.advice !== undefined) {
    const want = (Array.isArray(one.advice) ? one.advice : []).slice().sort();
    const got = findings.filter((finding) => !finding.code.startsWith('JTK_E_')).map((finding) => finding.code).sort();
    if (JSON.stringify(want) !== JSON.stringify(got)) out.push(`advice: the case says [${want.join(', ')}], the kit [${got.join(', ')}]`);
  }
  return out;
}
