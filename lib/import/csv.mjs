/**
 * A spreadsheet as `jtk import products` reads it: CSV as RFC 4180 has it — a
 * cell in quotes may hold the delimiter, a line break and a quote doubled —
 * from whichever program saved it.
 *
 *   a BOM          taken off (Excel's «CSV UTF-8» writes one)
 *   a line break   `\r\n`, `\n` or `\r`; inside quotes it is one `\n` in the cell
 *   the delimiter  the mapping's, or read off the header: `,`, `;` or a tab —
 *                  the one that divides the header most, outside quotes
 *   an empty line  skipped, and so is a line of nothing but delimiters; the
 *                  numbers of the lines after it do not move
 *
 * It refuses what would otherwise be read as another sheet: a quote never
 * closed, text after a closing quote, a row with more cells than the header
 * (an unquoted delimiter in a cell, which would move every cell after it one
 * column to the right). It decides nothing about what a cell means.
 *
 * Every row is told by the line it begins on — the header is line 1 — which is
 * what an editor and a spreadsheet's row number say while no cell holds a line
 * break, and what `rows[i]`'s `lines[i]` is for: every refusal of the import
 * names its row by it.
 */

const DELIMITERS = [',', ';', '\t'];

/** A sheet that cannot be read, with the line it was found on. */
export class SheetError extends Error {
  /** @param {string} message @param {number} [line] */
  constructor(message, line) {
    super(message);
    this.line = line;
  }
}

/**
 * The delimiter of a sheet: the one of `,`, `;` and a tab that divides the
 * header most outside quotes, a comma where none divides it.
 * @param {string} text the sheet, its BOM already taken off
 * @returns {string}
 */
export function delimiterOf(text) {
  const counts = new Map(DELIMITERS.map((one) => [one, 0]));
  let quoted = false;
  for (let at = 0; at < text.length; at++) {
    const one = text[at];
    if (one === '"') quoted = !quoted;
    else if (!quoted && (one === '\n' || one === '\r')) break;
    else if (!quoted && counts.has(one)) counts.set(one, counts.get(one) + 1);
  }
  let best = ',';
  for (const one of DELIMITERS) if (counts.get(one) > counts.get(best)) best = one;
  return best;
}

/**
 * @param {string} text the sheet, as UTF-8
 * @param {string} [delimiter] `,`, `;` or a tab; read off the header where not given
 * @returns {{ header: string[], rows: Record<string, string>[], lines: number[], delimiter: string }}
 *   `rows[i]` is a record by the header's names (the first of two columns with one name), `lines[i]` the line it begins on
 */
export function parseCSV(text, delimiter) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (delimiter !== undefined && !DELIMITERS.includes(delimiter)) throw new SheetError(`the delimiter is «${delimiter}»; a sheet's is a comma, a semicolon or a tab`);
  const separator = delimiter ?? delimiterOf(text);

  /** @type {{ cells: string[], line: number }[]} */
  const records = [];
  let at = 0;
  let line = 1;
  const newline = () => {
    // A line break is `\r\n`, `\n` or a lone `\r`: one line.
    if (text[at] === '\r' && text[at + 1] === '\n') at += 2;
    else at += 1;
    line += 1;
  };

  while (at < text.length) {
    const began = line;
    /** @type {string[]} */
    const cells = [];
    for (;;) {
      let value = '';
      if (text[at] === '"') {
        const opened = line;
        at += 1;
        for (;;) {
          if (at >= text.length) throw new SheetError(`a quote opened on line ${opened} is never closed`, opened);
          const one = text[at];
          if (one === '"') {
            if (text[at + 1] === '"') {
              value += '"';
              at += 2;
            } else {
              at += 1;
              break;
            }
          } else if (one === '\r' || one === '\n') {
            value += '\n';
            newline();
          } else {
            value += one;
            at += 1;
          }
        }
        if (at < text.length && text[at] !== separator && text[at] !== '\n' && text[at] !== '\r') {
          throw new SheetError(`line ${line}: text after a closing quote — a quote inside a quoted cell is written twice (""), and a cell with quotes is quoted whole`, line);
        }
      } else {
        const from = at;
        while (at < text.length && text[at] !== separator && text[at] !== '\n' && text[at] !== '\r') at += 1;
        value = text.slice(from, at);
      }
      cells.push(value);
      if (text[at] === separator) {
        at += 1;
        // A delimiter at the very end of the text is a last, empty cell.
        if (at >= text.length) {
          cells.push('');
          break;
        }
        continue;
      }
      if (at < text.length) newline();
      break;
    }
    // An empty line, or a line of nothing but delimiters, is no row.
    if (cells.every((cell) => cell.trim() === '')) continue;
    records.push({ cells, line: began });
  }

  if (records.length === 0) throw new SheetError('the sheet is empty: it has no header line');
  const header = records[0].cells.map((cell) => cell.trim());
  const rows = [];
  const lines = [];
  for (const { cells, line: where } of records.slice(1)) {
    // Cells past the header's that are empty are a trailing delimiter; any other is a cell the header has no name for.
    const extra = cells.slice(header.length);
    if (extra.some((cell) => cell.trim() !== '')) {
      throw new SheetError(`row ${where} has ${cells.length} cells and the header ${header.length} — a delimiter inside a cell that is not in quotes moves every cell after it`, where);
    }
    const row = {};
    header.forEach((name, i) => {
      if (name !== '' && !Object.hasOwn(row, name)) row[name] = cells[i] ?? '';
    });
    rows.push(row);
    lines.push(where);
  }
  return { header, rows, lines, delimiter: separator };
}
