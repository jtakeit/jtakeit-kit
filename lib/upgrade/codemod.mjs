/**
 * `src/content/blocks.ts` rewritten in contract 3's words, in place
 * (jtakeit-core wiki/98 §7 · 2): "the scaffold's declarations are data
 * literals, so this is a codemod".
 *
 * Each literal the tables are made of — a block type, a field, a view, a
 * collection — is read for its value, mapped as `@jtakeit/kit`'s upgrade maps
 * it (field3, block3, collection3), and only what changed is written back: a
 * property removed, a value replaced, one added after its neighbour. Every
 * comment, every blank line and every literal the mapping leaves alone stays
 * as the developer wrote it. The scaffold's own contract-2 types (`Field`,
 * `Block`, `View`, `Collection`, `Kind`, `Modules`) give way to
 * `@jtakeit/kit/schema`'s, `export const CONTRACT = 3` is said once, and the
 * business facts become the shared `contacts` block (§4.5).
 *
 * Where a table is not a data literal — a spread, a call, a value made
 * elsewhere — the codemod says so rather than guessing; and the command that
 * runs it then imports what it wrote and holds it to the tables the mapping
 * made of the old declaration, so a rewrite that says anything else is never
 * written.
 *
 * The TypeScript parser is the site's own (`typescript`, a devDependency of
 * every scaffold), handed in.
 */
import { block3, collection3, field3, fields3 } from '@jtakeit/kit/upgrade';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * A value as source, in the style of the literal it goes into: JSON's, where
 * that literal quotes its keys (the kits' and the blog's were written by
 * JSON.stringify), else the scaffold's — single quotes, bare keys, on one
 * line where it fits.
 */
export function serialize(value, style, indent) {
  if (style === 'json') {
    return JSON.stringify(value, null, 2).split('\n').join(`\n${indent}`);
  }
  const inline = (one) => {
    if (Array.isArray(one)) return `[${one.map(inline).join(', ')}]`;
    if (isObject(one)) {
      const parts = Object.entries(one).map(([key, inner]) => `${IDENTIFIER.test(key) ? key : `'${key}'`}: ${inline(inner)}`);
      return parts.length === 0 ? '{}' : `{ ${parts.join(', ')} }`;
    }
    if (typeof one === 'string') return `'${one.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    return JSON.stringify(one);
  };
  const flat = inline(value);
  if (flat.length + indent.length <= 110 || (!Array.isArray(value) && !isObject(value))) return flat;
  const inner = `${indent}  `;
  if (Array.isArray(value)) return `[\n${value.map((one) => `${inner}${serialize(one, style, inner)},`).join('\n')}\n${indent}]`;
  return `{\n${Object.entries(value)
    .map(([key, one]) => `${inner}${IDENTIFIER.test(key) ? key : `'${key}'`}: ${serialize(one, style, inner)},`)
    .join('\n')}\n${indent}}`;
}

/**
 * Rewrite a contract-2 declaration's source.
 *
 * @param {string} source the file
 * @param {any} ts the TypeScript compiler API
 * @param {{
 *   whole: Map<string, string[]>;   per block type, the counts a module reads as whole numbers
 *   ownListings: Set<string>;       the prefixes the repository lists at itself
 *   contacts?: any;                 the contacts block type the facts became
 *   shared: string[];               the block types the shared text holds
 *   upgraded: string;               a line for the comment: by what, and when
 *   added?: Map<string, { fields: any[]; note: string }>;
 *                                   per block type, fields the move declares besides the mapping's,
 *                                   written after its last field under a line of comment
 * }} plan
 * @returns {{ source: string; faults: string[] }}
 */
export function rewriteDeclaration(source, ts, plan) {
  const file = ts.createSourceFile('blocks.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const edits = [];
  const faults = [];
  const edit = (start, end, text) => edits.push({ start, end, text });

  /** A literal's value, its types stripped: a data literal reads as itself, anything else is a fault. */
  function valueOf(node) {
    const text = node.getText(file);
    try {
      const js = ts.transpileModule(`export default (${text});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
      const module = { exports: {} };
      new Function('module', 'exports', 'require', js)(module, module.exports, () => {
        throw new Error('not a data literal');
      });
      return module.exports.default;
    } catch {
      return undefined;
    }
  }

  const where = (node) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    return `src/content/blocks.ts:${line + 1}`;
  };
  const indentAt = (node) => {
    const start = node.getStart(file);
    const lineStart = source.lastIndexOf('\n', start - 1) + 1;
    return /^[ \t]*/.exec(source.slice(lineStart, start))[0];
  };
  const nameOf = (property) => {
    if (!ts.isPropertyAssignment(property)) return undefined;
    const name = property.name;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
    return undefined;
  };
  const styleOf = (object) => (object.properties.some((one) => one.name !== undefined && ts.isStringLiteral(one.name)) ? 'json' : 'ts');
  const multiline = (object) => {
    const open = file.getLineAndCharacterOfPosition(object.getStart(file)).line;
    const close = file.getLineAndCharacterOfPosition(object.getEnd()).line;
    return close > open;
  };
  /** The end of a node and of the comma after it, where one follows. */
  const withComma = (node) => {
    let end = node.getEnd();
    const after = source.slice(end).match(/^\s*,/);
    if (after) end += after[0].length;
    return end;
  };
  const resolveIdentifier = (identifier) => {
    for (const statement of file.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === identifier.text && declaration.initializer) return declaration.initializer;
      }
    }
    return undefined;
  };
  const literal = (node) => {
    let at = node;
    while (at && (ts.isAsExpression(at) || ts.isSatisfiesExpression?.(at) || ts.isParenthesizedExpression(at))) at = at.expression;
    if (at && ts.isIdentifier(at)) return literal(resolveIdentifier(at));
    return at;
  };

  /**
   * One object literal from what it says to what it should say: the keys it
   * drops removed, the ones that changed replaced, the new ones put after
   * the key before them. `deeper` names the keys whose arrays are rewritten
   * element by element instead of whole, so what is inside keeps its words.
   */
  function rewriteObject(object, before, after, deeper = {}) {
    const style = styleOf(object);
    const props = new Map();
    for (const property of object.properties) {
      const name = nameOf(property);
      if (name === undefined) {
        faults.push(`${where(property)}: ${property.getText(file).slice(0, 60)} is not a property the codemod can read — rewrite this ${before.key ?? before.type ?? before.name ?? 'table'} by hand in contract 3's words`);
        return;
      }
      props.set(name, property);
    }
    const keys = Object.keys(after);
    for (const [name, property] of props) {
      if (!Object.hasOwn(after, name)) {
        edit(property.getFullStart(), withComma(property), '');
        continue;
      }
      if (deeper[name] !== undefined && Array.isArray(before[name]) && Array.isArray(after[name])) {
        const array = literal(property.initializer);
        if (array && ts.isArrayLiteralExpression(array)) {
          deeper[name](array, before[name], after[name]);
          continue;
        }
      }
      if (!same(before[name], after[name])) {
        edit(property.initializer.getStart(file), property.initializer.getEnd(), serialize(after[name], style, indentAt(property)));
      }
    }
    // What is new, after the key before it in the mapped order: the new keys
    // after one kept key go in as one edit, in their order.
    const runs = new Map();
    keys.forEach((name, i) => {
      if (props.has(name)) return;
      let anchor;
      for (let j = i - 1; j >= 0; j--) {
        const kept = props.get(keys[j]);
        if (kept !== undefined) {
          anchor = kept;
          break;
        }
      }
      if (!runs.has(anchor)) runs.set(anchor, []);
      runs.get(anchor).push(name);
    });
    for (const [anchor, names] of runs) {
      const indent = anchor !== undefined ? indentAt(anchor) : `${indentAt(object)}  `;
      const texts = names.map((name) => `${style === 'json' || !IDENTIFIER.test(name) ? JSON.stringify(name) : name}: ${serialize(after[name], style, indent)}`);
      if (anchor !== undefined) {
        edit(anchor.getEnd(), anchor.getEnd(), multiline(object) ? texts.map((one) => `,\n${indent}${one}`).join('') : texts.map((one) => `, ${one}`).join(''));
      } else {
        const open = object.getStart(file) + 1;
        edit(open, open, multiline(object) ? texts.map((one) => `\n${indent}${one},`).join('') : texts.map((one) => ` ${one},`).join(''));
      }
    }
  }

  /** A list of fields: the ones contract 3 folds away removed, each other rewritten. */
  function rewriteFields(array, before, how) {
    const after = fields3(before, how);
    const kept = new Set(after.map((one) => one?.key));
    array.elements.forEach((element, i) => {
      const node = literal(element);
      const was = before[i];
      if (!isObject(was)) return;
      if (!kept.has(was.key)) {
        edit(element.getFullStart(), withComma(element), '');
        return;
      }
      if (!node || !ts.isObjectLiteralExpression(node)) {
        if (!same(field3(was, how), was)) faults.push(`${where(element)}: the field ${was.key} is not a literal here — rewrite it by hand`);
        return;
      }
      rewriteField(node, was, how);
    });
  }

  function rewriteField(node, was, how) {
    const now = field3(was, how);
    if (same(now, was)) return;
    rewriteObject(node, was, now, {
      of: (array, before) => rewriteFields(array, before, { whole: how.whole }),
    });
  }

  /**
   * Fields the move declares besides the mapping's, after the last of a
   * block's own, under one line of comment: what the scaffold's contract-3
   * form reads that its contract-2 declaration had not got.
   */
  function appendFields(array, fields, note, style) {
    const last = array.elements.at(-1);
    if (last === undefined) {
      faults.push(`${where(array)}: a block with no fields to add ${fields.map((one) => one.key).join(', ')} after — rewrite it by hand`);
      return;
    }
    const indent = indentAt(last);
    const end = withComma(last);
    const trailing = end !== last.getEnd();
    const open = file.getLineAndCharacterOfPosition(array.getStart(file)).line;
    const close = file.getLineAndCharacterOfPosition(array.getEnd()).line;
    if (close > open) {
      const lines = fields.map((one) => `\n${indent}${serialize(one, style, indent)}`);
      edit(end, end, `${trailing ? '' : ','}\n${indent}// ${note}${lines.join(',')}${trailing ? ',' : ''}`);
    } else {
      edit(end, end, `${trailing ? ' ' : ', '}${fields.map((one) => serialize(one, style, indent)).join(', ')}${trailing ? ',' : ''}`);
    }
  }

  function rewriteBlock(node, was) {
    const how = { whole: plan.whole.get(was.type) ?? [] };
    const now = block3(was, how);
    const added = plan.added?.get(was.type);
    if (added !== undefined && added.fields.length > 0 && Array.isArray(now.fields)) now.fields = [...now.fields, ...added.fields];
    if (same(now, was)) return;
    rewriteObject(node, was, now, {
      fields: (array, before) => {
        rewriteFields(array, before, how);
        if (added !== undefined && added.fields.length > 0) appendFields(array, added.fields, added.note, styleOf(node));
      },
      asks: (array, before) => rewriteFields(array, before, how),
      views: (array, before, after) => {
        array.elements.forEach((element, i) => {
          const view = literal(element);
          if (view && ts.isObjectLiteralExpression(view) && !same(before[i], after[i])) rewriteObject(view, before[i], after[i]);
        });
      },
    });
  }

  function rewriteCollection(node, was) {
    const now = collection3(was, plan.ownListings);
    if (same(now, was)) return;
    rewriteObject(node, was, now);
  }

  /** The literals already rewritten: a block both declared and pushed is rewritten once. */
  const done = new Set();

  /** The elements of a table, each its own literal: an array's, or a push's arguments. */
  function eachOf(nodes, rewrite, kind) {
    for (const element of nodes) {
      const node = literal(element);
      if (node !== undefined && done.has(node)) continue;
      if (node !== undefined) done.add(node);
      if (!node || !ts.isObjectLiteralExpression(node)) {
        faults.push(`${where(element)}: ${element.getText(file).slice(0, 60)} is not a ${kind} the codemod can read — rewrite it by hand in contract 3's words`);
        continue;
      }
      const was = valueOf(node);
      if (!isObject(was)) {
        faults.push(`${where(node)}: this ${kind} is not a data literal — rewrite it by hand in contract 3's words`);
        continue;
      }
      rewrite(node, was);
    }
  }

  const removedTypes = [];
  const TYPES = new Set(['Kind', 'Field', 'Block', 'View', 'Collection', 'Modules']);
  let facts;
  let lastStatement;

  for (const statement of file.statements) {
    lastStatement = statement;
    // The scaffold's own contract-2 types: @jtakeit/kit/schema's from here.
    if ((ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) && TYPES.has(statement.name.text)) {
      removedTypes.push(statement.name.text);
      edit(statement.getFullStart(), statement.getEnd(), '');
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const name = declaration.name.text;
        const init = literal(declaration.initializer);
        // Typed by the scaffold's own tables: a block, a collection or fields
        // kept ready to push (the blog's), rewritten whether pushed or not, so
        // they still type-check as @jtakeit/kit/schema's.
        const typed = declaration.type?.getText(file).replace(/\s+/g, '') ?? '';
        if (name === 'BLOCKS' && init && ts.isArrayLiteralExpression(init)) eachOf(init.elements, rewriteBlock, 'block type');
        else if (name === 'COLLECTIONS' && init && ts.isArrayLiteralExpression(init)) eachOf(init.elements, rewriteCollection, 'collection');
        else if (name === 'BUSINESS_FACTS') facts = statement;
        else if (name === 'CONTRACT') faults.push(`${where(statement)}: CONTRACT is said already — this declaration is not contract 2's`);
        else if ((name === 'PAGE_SEO' || typed === 'Field[]') && init && ts.isArrayLiteralExpression(init)) {
          const was = valueOf(init);
          if (Array.isArray(was)) rewriteFields(init, was, {});
          else faults.push(`${where(init)}: ${name} is not a data literal — rewrite it by hand`);
        } else if (typed === 'Block' && init) eachOf([init], rewriteBlock, 'block type');
        else if (typed === 'Block[]' && init && ts.isArrayLiteralExpression(init)) eachOf(init.elements, rewriteBlock, 'block type');
        else if (typed === 'Collection' && init) eachOf([init], rewriteCollection, 'collection');
        else if (typed === 'Collection[]' && init && ts.isArrayLiteralExpression(init)) eachOf(init.elements, rewriteCollection, 'collection');
        else if (typed === 'Field' && init && ts.isObjectLiteralExpression(init) && !done.has(init)) {
          done.add(init);
          const was = valueOf(init);
          if (isObject(was)) rewriteField(init, was, {});
        }
      }
      continue;
    }
    // BLOCKS.push(…), COLLECTIONS.push(…): a kit's tables, the blog's.
    if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)) {
      const call = statement.expression;
      if (ts.isPropertyAccessExpression(call.expression) && ts.isIdentifier(call.expression.expression) && call.expression.name.text === 'push') {
        const table = call.expression.expression.text;
        if (table === 'BLOCKS') eachOf(call.arguments, rewriteBlock, 'block type');
        if (table === 'COLLECTIONS') eachOf(call.arguments, rewriteCollection, 'collection');
      }
    }
  }

  // The business's facts: the shared `contacts` block, with roles (§4.5).
  if (facts !== undefined && plan.contacts !== undefined) {
    edit(
      facts.getStart(file),
      facts.getEnd(),
      [
        `export const CONTACTS: Block = ${serialize(plan.contacts, 'ts', '')};`,
        '',
        '/** The block types the shared text holds: on every page, in no page (wiki/98 §3.1). */',
        `export const SHARED: string[] = ${serialize(plan.shared, 'ts', '')};`,
      ].join('\n'),
    );
  } else if (facts !== undefined) {
    edit(facts.getFullStart(), facts.getEnd(), '');
  }

  // The foot: the contacts among the types, after everything else pushed.
  const foot = [];
  if (facts !== undefined && plan.contacts !== undefined) {
    foot.push('', "// The business's facts, shared text with roles since `jtk upgrade contract-3` (wiki/98 §4.5).", 'BLOCKS.push(CONTACTS);');
  } else if (plan.shared.length > 0) {
    foot.push('', '/** The block types the shared text holds: on every page, in no page (wiki/98 §3.1). */', `export const SHARED: string[] = ${serialize(plan.shared, 'ts', '')};`);
  }
  if (foot.length > 0 && lastStatement !== undefined) edit(lastStatement.getEnd(), lastStatement.getEnd(), `\n${foot.join('\n')}`);

  // The head: the types and the contract, after the file's first comment.
  // The types the file still names, imported once the edits are made.
  const IMPORTS = '\u0000imports\u0000';
  const head = [
    IMPORTS,
    '',
    '/**',
    ' * Contract 3 (jtakeit-core wiki/98 §3): `npx @jtakeit/astro schema` writes',
    ' * jtk/schema.json from this file, and the tables below are in its words —',
    ' * options as `{ value, label }`, a reference as `{ to }`, a collection\'s',
    ' * `route` and `shown_on`, the business\'s facts as the shared `contacts`.',
    ` * ${plan.upgraded}; what the notes in this file still say`,
    ' * of jtk/catalogue.json, `prefix`, `pages` and BUSINESS_FACTS is contract 2\'s.',
    ' */',
    'export const CONTRACT = 3;',
    '',
  ].filter((line, i) => !(i === 0 && line === ''));
  const comments = ts.getLeadingCommentRanges(source, 0) ?? [];
  const after = comments.length > 0 ? comments[0].end : 0;
  edit(after, after, `${after > 0 ? '\n\n' : ''}${head.join('\n')}`);

  // Applied from the end, so every position still means what it meant.
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let out = source;
  let floor = Infinity;
  for (const one of edits) {
    if (one.end > floor) {
      faults.push(`two edits at ${one.start} overlap — rewrite the declaration by hand`);
      continue;
    }
    out = out.slice(0, one.start) + one.text + out.slice(one.end);
    floor = Math.min(floor, one.start);
  }
  const named = removedTypes.filter((name) => new RegExp(`\\b${name}\\b`).test(out.replace(IMPORTS, '')));
  if (facts !== undefined && plan.contacts !== undefined && !named.includes('Block')) named.push('Block');
  out = out.replace(IMPORTS, named.length > 0 ? `import type { ${[...new Set(named)].sort().join(', ')} } from '@jtakeit/kit/schema';` : '');
  // Blank lines the removed types left, as one — where the file kept to one itself.
  if (!/\n{3,}/.test(source)) out = out.replace(/\n{3,}/g, '\n\n');
  return { source: out, faults };
}
