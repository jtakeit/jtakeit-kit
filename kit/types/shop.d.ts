import type { Entry } from './content';

/** A product's facts as the product page needs them: prices are whole minor units of the site's currency. */
export interface ProductFacts {
  /** The entry's `id`, as the shop's addresses name the product. */
  id: string;
  currency: string;
  /** Whether stock is counted; a product that is not tracked is never sold out. */
  tracked: boolean;
  options: { key: string; name: string; values: { key: string; label: string }[] }[];
  variants: { key: string; sku: string; price?: number; picks: Record<string, string>; onSale: boolean }[];
  customizations: {
    key: string;
    name: string;
    kind: 'choice' | 'yes_no' | 'text';
    required: boolean;
    max?: number;
    adds?: number;
    choices: { key: string; label: string; adds?: number }[];
  }[];
}
export type ValueState = 'in_stock' | 'sold_out' | 'none';
/** A product's facts, read through the door. `currency` is the site's, from `jtk/site.json`. */
export function productFacts(entry: Entry, currency: string): ProductFacts;
/** The variant whose picks equal what is chosen, every option and nothing else. */
export function variantFor(facts: ProductFacts, chosen: Record<string, string>): ProductFacts['variants'][number] | undefined;
/**
 * Each option's values, given the other options as chosen: a variant in stock, only sold out, or none on sale.
 * `stock` is by the variant's `_key`, the stock answer's `key`; a variant it has not named reads as the build says.
 */
export function valueStates(
  facts: ProductFacts,
  stock: Record<string, 'in_stock' | 'sold_out' | 'off_sale'>,
  chosen: Record<string, string>,
): Record<string, Record<string, ValueState>>;
/** What a form gave, held to what the product asks: the answers a cart line carries, and the faults by question. */
export function answersOf(
  facts: ProductFacts,
  given: Record<string, string | boolean>,
): { answers: Record<string, string | boolean>; faults: { key: string; word: 'required' | 'too_long' | 'not_a_choice' }[] };
/** The lowest price of the variants on sale. */
export function fromPrice(facts: ProductFacts): number | undefined;
