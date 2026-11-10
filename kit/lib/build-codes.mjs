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
  CATALOGUE_MISSING: 'JTK_E_CATALOGUE_MISSING',
  FORM_INCOMPLETE: 'JTK_E_FORM_INCOMPLETE',
  FORM_FIELD_UNDECLARED: 'JTK_E_FORM_FIELD_UNDECLARED',
  FORM_UNDECLARED: 'JTK_E_FORM_UNDECLARED',
  // Not the build's: the platform's code for a content file it cannot read as
  // a document (sites/judgeFiles.go, `From: platform`), which its import says
  // of a file. The lint says it of a contract-3 file without the names its
  // annotations are written with — an `id`, a `_key` (jtakeit-core wiki/98
  // §15 · 12) — because the fix is in the file, and the platform's judge is
  // the one that refuses such a file there.
  CONTENT_FILE_INVALID: 'JTK_E_CONTENT_FILE_INVALID',
});

/** One line of the lint's output, with its code in front of it. */
export function said(code, message) {
  return `${code} ${message}`;
}
