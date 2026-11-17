/**
 * `jtk import products` — a spreadsheet's products, as contract 3's entries
 * (jtakeit-core wiki/102 stage 9, decision 9).
 *
 *   jtk import products <file.csv> --map <mapping.json> [--root <dir>] [--currency <xxx>] [--words] [--media '<link>'] [--dry-run]
 *
 * The sheet is a WooCommerce or a Shopify export, or any CSV, read through a
 * mapping that says which column is which field of a product (lib/import/mapping.mjs).
 * What it writes is what the door reads — `jtk/entries/<collection>/<slug>.json`
 * for each product, `<slug>.<locale>.json` for the words the sheet has in another
 * language — with the business's SKUs kept and the missing ones made as the
 * platform makes them, the options' keys made from their names, and a second
 * import of the same sheet matched by SKU (lib/import/products.mjs). The starting
 * stock goes into `.jtakeit/stock.txt` for `set_stock`, never into the site.
 *
 * The pictures its rows name are fetched here, on this machine and never by the
 * platform, into `src/assets/products/` and named in the entries as slots
 * (lib/import/pictures.mjs); `--media '<link>'` — media_link's — then runs
 * `jtk media push`, which writes the library's keys in their place. A picture
 * still a file here when it ends is said, and the exit is 1: the platform builds
 * from git, and a slot is not on the site.
 *
 * Everything is read and judged before anything is written or fetched: a sheet
 * with one fault, or a site that is not on contract 3, leaves the tree as it
 * was, and every fault names its row and column.
 *
 * Plan, then write: `--dry-run` prints the plan and stops there.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { contractOf } from '@jtakeit/kit/content/node';
import { ServerError, parseCodeUrl } from './code/wire.mjs';
import { parseCSV, SheetError } from './import/csv.mjs';
import { MappingError, readMapping } from './import/mapping.mjs';
import { FOLDER, fetchPictures } from './import/pictures.mjs';
import { PICTURES_IGNORE, STOCK_IGNORE, ignorePictures, planImport } from './import/products.mjs';
import { outsideLibrary, push } from './media.mjs';
import { treeOf } from './units/index.mjs';

/** The most a refusal lists before it says how many more there are. */
const LISTED = 50;
/** The most SKUs made, changes and said lines that a summary lists; past it, how many. */
const MADE_LISTED = 20;
const CHANGES_LISTED = 40;
const SAID_LISTED = 40;

export function usage() {
  return `  jtk import products <file.csv> --map <mapping.json> [--root <dir>] [--currency <xxx>] [--words] [--media '<link>'] [--dry-run]
                                  a WooCommerce or Shopify export, or any CSV, read through
                                  a mapping into the shop's products — contract 3's entry
                                  files: the business's SKUs kept, the missing ones made as
                                  the platform makes them, the options' keys from their names.
                                  A second import is matched by SKU: it takes the sheet's
                                  numbers and keeps the owner's words, ids and keys (--words
                                  takes the sheet's words too). The starting stock goes into
                                  .jtakeit/stock.txt for set_stock, never into the site.
                                  The pictures the sheet names, addresses and paths inside
                                  the sheet's folder, are fetched on this machine into
                                  src/assets/products/ and named in the entries — photographs
                                  only (JPEG, PNG, WebP, AVIF), by their bytes; an SVG is
                                  added by hand; --media with media_link's URL pushes them to
                                  the site's library (jtk media push, which sends whatever
                                  else the content names too), and a picture still a file here
                                  is said, the exit 1: the platform builds from git.
                                  Everything is judged before anything is written, and a
                                  refusal names its row — the line of the sheet, the header
                                  being line 1 — and its column; --dry-run says what it would
                                  write and fetch, and does neither`;
}

/** A command line that cannot be read. */
class Usage extends Error {}

/**
 * @param {string[]} args
 * @returns {{ file: string, map: string, root: string | undefined, currency: string | undefined, words: boolean, media: string | undefined, dryRun: boolean }}
 */
function optionsOf(args) {
  const [what, ...rest] = args;
  if (what !== 'products') throw new Usage(what === undefined ? 'what to import? `jtk import products <file.csv> --map <mapping.json>`' : `${what} is not something to import: \`jtk import products <file.csv> --map <mapping.json>\``);
  const options = { file: undefined, map: undefined, root: undefined, currency: undefined, words: false, media: undefined, dryRun: false };
  for (let i = 0; i < rest.length; i += 1) {
    const one = rest[i];
    const value = () => {
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) throw new Usage(`${one} needs a value`);
      i += 1;
      return next;
    };
    if (one === '--map') options.map = value();
    else if (one === '--root') options.root = value();
    else if (one === '--currency') options.currency = value();
    else if (one === '--words') options.words = true;
    else if (one === '--media') options.media = value();
    else if (one === '--dry-run') options.dryRun = true;
    else if (one.startsWith('--')) throw new Usage(`${one} is not an option of jtk import products`);
    else if (options.file === undefined) options.file = one;
    else throw new Usage(`${one}: one sheet at a time — ${options.file} is the sheet`);
  }
  if (options.file === undefined) throw new Usage('which sheet? `jtk import products <file.csv> --map <mapping.json>`');
  if (options.map === undefined) throw new Usage('--map <mapping.json> says which column is which field of a product');
  return /** @type {any} */ (options);
}

/** A file as UTF-8, or the reason it is not: a sheet read as another encoding is words written wrong. */
function textOf(file, what) {
  let bytes;
  try {
    bytes = readFileSync(file);
  } catch (why) {
    throw new Usage(`${what} ${file} cannot be read: ${why instanceof Error ? why.message : why}`);
  }
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff)) {
    throw new Usage(`${what} ${file} is UTF-16 — save it as CSV UTF-8`);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Usage(`${what} ${file} is not UTF-8 — save it as CSV UTF-8, so that no word in it is read as another`);
  }
}

/** The site's currency: `--currency`, else `jtk/site.json`'s; never one that contradicts the other. */
function currencyOf(tree, said) {
  const site = (() => {
    try {
      return tree.json('jtk/site.json')?.currency;
    } catch {
      return undefined;
    }
  })();
  const kept = typeof site === 'string' && site.trim() !== '' ? site.trim().toUpperCase() : undefined;
  if (said !== undefined) {
    if (!/^[A-Za-z]{3}$/.test(said)) throw new Usage(`--currency ${said} is not a currency: three letters (CHF, EUR, JPY…)`);
    if (kept !== undefined && kept !== said.toUpperCase()) {
      throw new Usage(`--currency ${said.toUpperCase()} is not the site's currency, ${kept} (jtk/site.json): a site has one — leave --currency out, or change the site's in the panel first`);
    }
    return said.toUpperCase();
  }
  if (kept === undefined) throw new Usage('the site\'s currency is not known: jtk/site.json has none — say it with `--currency <xxx>` (CHF, EUR, JPY…); the prices are read in its minor unit');
  if (!/^[A-Z]{3}$/.test(kept)) throw new Usage(`the site's currency, ${kept}, in jtk/site.json is not three letters — say it with \`--currency <xxx>\``);
  return kept;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The command, its output and its exit status.
 * @param {string[]} args `products <file.csv> --map <mapping.json> …`
 * @param {{ cwd?: string, out?: (line: string) => void, err?: (line: string) => void, fetch?: typeof fetch, sleep?: (ms: number) => Promise<void> }} [io]
 *   `fetch` the one the pictures' addresses are fetched with and the push talks through; `sleep` the push's wait for the platform to slow down
 * @returns {Promise<number>}
 */
export async function main(args, io = {}) {
  const out = io.out ?? console.log;
  const err = io.err ?? console.error;
  const cwd = io.cwd ?? process.cwd();
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    err(`usage:\n${usage()}`);
    return args.length === 0 ? 1 : 0;
  }
  try {
    const options = optionsOf(args);
    const root = resolve(cwd, options.root ?? '.');

    // A site that is not on contract 3 is refused before the sheet is read: contract 2 has no products to write.
    if (contractOf(root) !== 3) {
      err(`jtk import products: this site is not on contract 3 — ${root} has no contract-3 jtk/schema.json — \`jtk upgrade contract-3\` first (or --root <dir> says where the site is)`);
      return 1;
    }

    // The link `--media` is given is judged before anything is read: whatever it says, the token is never put in a message of ours.
    let token = '';
    if (options.media !== undefined) {
      try {
        token = parseCodeUrl(options.media, { tool: 'media_link' }).token;
      } catch (why) {
        throw new Usage(`--media: ${why instanceof Error ? why.message : why}`);
      }
    }
    const clean = (line) => (token === '' ? line : line.split(token).join('<token>'));

    const mapText = textOf(resolve(cwd, options.map), 'the mapping');
    const sheetFile = resolve(cwd, options.file);
    let delimiter;
    try {
      delimiter = { ',': ',', ';': ';', '\t': '\t', tab: '\t' }[JSON.parse(mapText)?.delimiter];
    } catch {
      // Not JSON: readMapping says so, below.
    }
    const sheet = parseCSV(textOf(sheetFile, 'the sheet'), delimiter);
    const mapping = readMapping(mapText, sheet.header);
    if (options.media !== undefined && mapping.fields.pictures === undefined) {
      throw new Usage('--media sends the pictures the sheet names, and the mapping names no `pictures` column');
    }

    const tree = treeOf(root);
    const currency = currencyOf(tree, options.currency);
    let plan = planImport(tree, sheet, mapping, { currency, words: options.words });

    const refusal = () => {
      err(`jtk import products: ${plural(plan.refused.length, 'thing')} refused, and nothing was written:`);
      for (const one of plan.refused.slice(0, LISTED)) err(`  ${one}`);
      if (plan.refused.length > LISTED) err(`  … and ${plan.refused.length - LISTED} more`);
      return 1;
    };
    if (plan.refused.length > 0) return refusal();

    const factsOf = () => ({
      made: plan.products.filter((one) => one.action === 'made'),
      updated: plan.products.filter((one) => one.action === 'updated'),
      left: plan.products.filter((one) => one.action === 'left'),
      skus: plan.products.flatMap((one) => one.made.map((sku) => `${one.slug}: ${sku.key} SKU ${sku.sku} made`)),
      stockFiles: [...plan.writes].filter(([path, text]) => text !== null && /^\.jtakeit\/stock(-\d+)?\.txt$/.test(path)).map(([path]) => path),
    });

    if (options.dryRun) {
      const { stockFiles } = factsOf();
      out('jtk import products --dry-run: this is what it would do, and nothing is written or fetched.');
      for (const one of plan.products) {
        out(`  would ${one.action === 'left' ? 'leave' : one.action === 'made' ? 'make' : 'update'} ${one.slug}${one.action === 'left' ? ' as it is' : ''} (row ${one.line}, ${plural(one.variants, 'variant')})`);
        for (const sku of one.made) out(`    ${one.slug}: ${sku.key} SKU ${sku.sku} made`);
        for (const change of one.changes) out(`    ${change}`);
        if (one.pictures.length > 0) out(`    would fetch ${plural(one.pictures.length, 'picture')} into ${FOLDER}/ and name ${one.pictures.length === 1 ? 'it' : 'them'} as the cover${one.pictures.length === 1 ? '' : ' and the pictures'}`);
        else if (one.keeps) out('    keeps its pictures: the sheet\'s are not fetched again');
      }
      for (const one of plan.said) out(`  ${one}`);
      for (const file of stockFiles) {
        const lines = plan.writes.get(file).trimEnd().split('\n');
        out(`  would write ${file}, ${plural(lines.length, 'line')}, for set_stock:`);
        for (const line of lines) out(`    ${line}`);
      }
      if (plan.writes.has('.gitignore')) out(`  would add ${STOCK_IGNORE} to .gitignore: the stock is never in the site's files`);
      if (plan.products.some((one) => one.pictures.length > 0)) {
        // Said only where the file does not say it already.
        const would = new Map();
        ignorePictures(tree, would);
        if (would.has('.gitignore')) out(`  would add ${PICTURES_IGNORE} to .gitignore: a picture is never in git`);
        if (options.media !== undefined) out('  with --media, media push would then send them to the site\'s library');
      }
      for (const [path, text] of plan.writes) if (text === null) out(`  would delete ${path}, a stock file of an earlier import that this one has no lines for`);
      return 0;
    }

    // The pictures: fetched here, once the sheet is judged and before anything is written, and laid into a second plan of the same sheet.
    let pictureSaid = [];
    let fetched = new Map();
    const fetching = plan.products.filter((one) => one.pictures.length > 0);
    if (fetching.length > 0) {
      out(`jtk import products: fetching ${plural(fetching.reduce((n, one) => n + one.pictures.length, 0), 'picture')} of ${plural(fetching.length, 'product')}, here on this machine:`);
      const got = await fetchPictures(fetching, {
        root,
        from: dirname(sheetFile),
        fetch: io.fetch,
        progress: out,
        // Before the first picture is a file, so that none is ever one git would take.
        beforeFirstFile() {
          const writes = new Map();
          ignorePictures(tree, writes);
          if (writes.has('.gitignore')) {
            tree.write('.gitignore', writes.get('.gitignore'));
            tree.commit();
          }
        },
      });
      pictureSaid = got.said;
      fetched = got.slots;
      if (fetched.size > 0) {
        plan = planImport(tree, sheet, mapping, { currency, words: options.words, pictures: fetched });
        if (plan.refused.length > 0) return refusal();
      }
    }
    const { made, updated, left, skus, stockFiles } = factsOf();

    for (const [path, text] of plan.writes) {
      if (text === null) tree.remove(path);
      else tree.write(path, text);
    }
    tree.commit();

    out(`jtk import products: ${plural(plan.products.length, 'product')} — ${made.length} made, ${updated.length} updated, ${left.length} left as they are; ${plural(plan.products.reduce((n, one) => n + one.variants, 0), 'variant')} in them.`);
    if (skus.length > 0 && skus.length <= MADE_LISTED) for (const one of skus) out(`  ${one}`);
    else if (skus.length > 0) out(`  ${plural(skus.length, 'SKU')} made as the platform makes them (--dry-run lists them before they are written)`);
    const changes = updated.flatMap((one) => one.changes);
    if (changes.length > 0 && changes.length <= CHANGES_LISTED) for (const one of changes) out(`  ${one}`);
    else if (changes.length > 0) out(`  ${plural(changes.length, 'change')} to ${plural(updated.length, 'product')} (--dry-run lists each, before → after)`);
    for (const one of plan.said.slice(0, SAID_LISTED)) out(`  ${one}`);
    if (plan.said.length > SAID_LISTED) out(`  … and ${plan.said.length - SAID_LISTED} more said (--dry-run says each)`);
    // A picture left out is said with its row and its address, as the other said lines are: a few of them, and how many more.
    for (const one of pictureSaid.slice(0, SAID_LISTED)) out(`  ${one}`);
    if (pictureSaid.length > SAID_LISTED) out(`  … and ${pictureSaid.length - SAID_LISTED} more pictures left out, each for a reason like these`);
    const keeping = plan.products.filter((one) => one.keeps).length;
    if (keeping > 0) out(`  ${plural(keeping, 'product')} ${keeping === 1 ? 'keeps' : 'keep'} the pictures ${keeping === 1 ? 'it has' : 'they have'}: the sheet's are not fetched again`);
    if (fetched.size > 0 || pictureSaid.length > 0) {
      const had = [...fetched.values()].reduce((n, slots) => n + slots.length, 0);
      out(`  pictures: ${plural(had, 'picture')} of ${plural(fetched.size, 'product')} fetched into ${FOLDER}/ and named as slots${pictureSaid.length > 0 ? `, ${pictureSaid.length} left out` : ''}${fetched.size > 0 ? `; .gitignore names ${PICTURES_IGNORE}` : ''}`);
    }
    if (stockFiles.length > 0) out(`  stock: ${plural(plan.stock.length, 'line')} in ${stockFiles.join(', ')} — for set_stock, never in the site's files; .gitignore names ${STOCK_IGNORE}`);

    // `--media`: the pictures go to the library by media push, here and now; what it leaves, or all of them without it, is said.
    let status = 0;
    /** The pictures the products' entries name that are files of this machine alone: what has to be pushed before a commit. */
    const files = () => (mapping.fields.pictures !== undefined && plan.collection !== undefined ? outsideLibrary(root).filter((use) => use.file.startsWith(`jtk/entries/${plan.collection}/`)).length : 0);
    const named = files();
    let stopped;
    if (options.media !== undefined) {
      try {
        await push([options.media, '--root', root], {
          cwd: root,
          out: (line) => out(clean(line)),
          fetch: io.fetch,
          sleep: io.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms))),
        });
      } catch (why) {
        stopped = why instanceof ServerError ? `${why.code}${why.message ? ` — ${why.message}` : ''}` : why instanceof Error ? why.message : String(why);
      }
    }
    const waiting = options.media === undefined ? named : files();
    // A push that stopped part-way is said as what it is: how many of the pictures went, and how many did not.
    if (stopped !== undefined) {
      const sent = Math.max(0, named - waiting);
      err(clean(`jtk import products: the push stopped — ${stopped}: ${sent} of the ${plural(named, 'picture')} named by the products ${sent === 1 ? 'was' : 'were'} sent, ${waiting} ${waiting === 1 ? 'is' : 'are'} still ${waiting === 1 ? 'a file' : 'files'} on this machine`));
    }
    if (waiting > 0) {
      status = 1;
      out(`  ${waiting === 1 ? '1 picture is a file' : `${waiting} pictures are files`} on this machine only: push ${waiting === 1 ? 'it' : 'them'} (\`--media\` with a new link from \`media_link\`) before you commit — the platform builds from git, and a picture still a file here is not on the site`);
    }
    out('next:');
    out('  - `jtk schema --judge` (or validate_schema by site and ref) judges the site with its products before anything is pushed');
    if (stockFiles.length > 0) out(`  - set_stock, with the text of each stock file: ${stockFiles.join(', ')} — a SKU that has sold is the owner's, and is left as it is`);
    else if (mapping.fields.stock === undefined) out('  - their stock: the mapping names no `stock` column, so none is written — set_stock sets it SKU by SKU');
    return status;
  } catch (why) {
    if (why instanceof MappingError) {
      err('jtk import products: the mapping is refused, and nothing was written:');
      for (const one of why.message.split('\n')) err(`  ${one}`);
      return 1;
    }
    if (why instanceof Usage || why instanceof SheetError) {
      err(`jtk import products: ${why.message}`);
      return 1;
    }
    err(`jtk import products: ${why instanceof Error ? why.message : why}`);
    return 1;
  }
}
