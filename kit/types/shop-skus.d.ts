/** How much of a made SKU is its base: 60 of the `sku` kind's 64 characters, leaving room for the number a taken one gets. */
export const SKU_ROOM: 60;
/** What SKUs are compared by: in lower case, so that `Mug` and `MUG` are one. */
export function skuKey(sku: string): string;
/**
 * The SKU a product's slug and the keys of a variant's values make, in the options' order — `T-SHIRT-FOX-M-RED`:
 * the platform's `SKUBase` (modules/shop/skus.go), made the same.
 */
export function skuBase(slug: string, values: string[]): string;
/**
 * The base if the site has not taken it, else the base with -2, -3 … — the platform's `FreeSKU`. `taken` is by `skuKey`,
 * and it grows by the SKU answered.
 */
export function freeSku(base: string, taken: Set<string>): string;
/**
 * A key made from a label, the panel's `keyOf` (widgets/shop/combinations.ts): `size`, `extra-large`, `x42`, `o1` for words
 * with no letter a key holds; a key `taken` gets `-2`, `-3` …, cut so the number fits in 32.
 */
export function keyOf(label: string, taken: ReadonlySet<string>, fallback: string): string;
