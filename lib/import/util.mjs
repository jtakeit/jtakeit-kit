/**
 * What the import's parts say alike: a value is an object, a list is a list or
 * is none, a number is said with its thousands, a name in the words the
 * messages quote it in.
 */

export const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const listOf = (value) => (Array.isArray(value) ? value : []);
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
/** A name or a value, as a message quotes it. */
export const q = (text) => `«${text}»`;
/** Characters, as the platform counts them: a Ukrainian title of 80 characters is 150 bytes. */
export const count = (text) => [...text].length;
export const thousands = (n) => n.toLocaleString('en-US');
/** `3`, `3 and 7`, `3, 7 and 9`. */
export const andList = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
/** A word or two of a longer text, on one line. */
export const clip = (text) => {
  const one = String(text).replace(/\s*\n\s*/g, ' / ');
  return count(one) > 80 ? `${[...one].slice(0, 77).join('')}…` : one;
};
/** A value in a `before → after` line: words quoted, a number as it is, nothing as `none`. */
export const shown = (value) => (value === undefined ? 'none' : typeof value === 'string' ? q(clip(value)) : String(value));

/** The longest an address may be to the server (the panel makes them of 60 at most, `slug.mjs`). */
export const SLUG_MOST = 80;
