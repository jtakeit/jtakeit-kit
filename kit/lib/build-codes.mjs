/**
 * The codes the annotation lint may say.
 *
 * A copy of the platform's `backend/api/sitebuild/errcodes.mjs`, which is
 * generated from the one declaration of the codes (`registry/errcode.go`), for
 * the same reason `codes.mjs` is a copy: a local lint that needs the network to
 * name a fault is a local lint nobody runs. What keeps it honest is the
 * platform's own parity test, which reads the lint it stages from this package
 * against the Go table on every builder change.
 */
export const CODES = Object.freeze({
  UNANNOTATED_FIELD: 'JTK_E_UNANNOTATED_FIELD',
  PAGE_NOT_BUILT: 'JTK_E_PAGE_NOT_BUILT',
  ROBOTS_DISALLOW: 'JTK_E_ROBOTS_DISALLOW',
  SITEMAP_EMPTY: 'JTK_E_SITEMAP_EMPTY',
  CANONICAL_ELSEWHERE: 'JTK_E_CANONICAL_ELSEWHERE',
  NOINDEX: 'JTK_E_NOINDEX',
  SHARED_NOT_RENDERED: 'JTK_E_SHARED_NOT_RENDERED',
  ANNOTATION_UNKNOWN: 'JTK_E_ANNOTATION_UNKNOWN',
  // The build says it of a lint run over a variant of the content
  // (pipeline.sh, variants.mjs); this lint runs over the content as written,
  // and never says it. Here so the table is the platform's, line for line.
  CONTENT_VARIANT: 'JTK_E_CONTENT_VARIANT',
  CATALOGUE_MISSING: 'JTK_E_CATALOGUE_MISSING',
  FORM_INCOMPLETE: 'JTK_E_FORM_INCOMPLETE',
  FORM_FIELD_UNDECLARED: 'JTK_E_FORM_FIELD_UNDECLARED',
  FORM_UNDECLARED: 'JTK_E_FORM_UNDECLARED',
  // Contract 3's (`Since: 3`): a page or an entry without an `id`, a block,
  // a row or a picture without a `_key` (jtakeit-core wiki/98 §15 · 12) —
  // which this lint said as JTK_E_CONTENT_FILE_INVALID, the platform's
  // import's code, until the build declared its own (jtakeit-core #186).
  UNNAMED: 'JTK_E_UNNAMED',
  // `dist/_meta.json` in a shape the platform does not read, `drafts` among
  // them, on a contract-3 site (§6).
  META_INVALID: 'JTK_E_META_INVALID',
});

/** One line of the lint's output, with its code in front of it. */
export function said(code, message) {
  return `${code} ${message}`;
}
