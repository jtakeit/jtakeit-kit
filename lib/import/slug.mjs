/**
 * A title as an address, made as the panel makes one — a copy of
 * `frontend/admin/src/lib/slug.ts` (`slugify`), jtakeit-core at 0e150d8a.
 *
 * The panel's own file says the transliteration is in one place so that a
 * second table of letters does not disagree with it; this is that table
 * again, held to the panel's cases by `test/import.test.mjs` (they are the
 * panel's `slug.test.ts`, copied, and some of its answers besides), because an
 * entry a person made in the panel and the same product named in a sheet must
 * come to one address, or a second import matches the one and makes the other.
 * Ukrainian first, as the panel has it: и → y, і → i, ї → yi, є → ye, г → h,
 * ґ → g; Russian, German and Polish letters too.
 */
const LETTERS = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh',
  з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'yu', я: 'ya',
  // Russian, for a client who writes in it.
  ё: 'e', ъ: '', ы: 'y', э: 'e',
  // German and Polish, spelled the way those languages spell them out.
  ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss',
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  č: 'c', ď: 'd', ě: 'e', ň: 'n', ř: 'r', š: 's', ť: 't', ů: 'u', ž: 'z',
};

/** How long an address the panel makes may be (the server takes 80). */
export const SLUG_MADE_MOST = 60;

/**
 * The address for a title: empty where there is nothing to make one from.
 * @param {string} title
 * @returns {string}
 */
export function slugify(title) {
  const letters = [...title.toLowerCase()]
    .map((character) => {
      if (Object.hasOwn(LETTERS, character)) return LETTERS[character];
      if (/[a-z0-9]/.test(character)) return character;
      // An accent nobody mapped: strip it and keep the letter under it, so «café» is `cafe` and not `caf`.
      const bare = character.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return /^[a-z0-9]+$/.test(bare) ? bare : '-';
    })
    .join('');
  return letters
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SLUG_MADE_MOST)
    .replace(/-$/, '');
}
