/**
 * RFC 4180 CSV: fields split on commas (or `delimiter`), a field in double quotes may hold
 * commas, line breaks and doubled quotes (`""` for one `"`). Rows end on
 * LF or CRLF. A leading UTF-8 BOM is dropped, a trailing newline adds no
 * row, and blank lines are skipped.
 *
 * Fields come back as written: no trimming, no type conversion.
 */
export function parseCsv(text: string, delimiter = ","): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  const endRow = () => {
    row.push(field);
    // A blank line is one empty field; it is not a row.
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
    field = "";
  };

  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      endRow();
      if (src[i + 1] === "\n") i += 1;
    } else if (ch === "\n") {
      endRow();
    } else {
      field += ch;
    }
    i += 1;
  }

  // The last row, when the file does not end on a newline.
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/**
 * The delimiter of a file from its first line: `;` when that line has more
 * semicolons than commas, else `,`. Strong's Android and current exports
 * use semicolons.
 */
export function detectDelimiter(text: string): "," | ";" {
  const end = text.search(/\r|\n/);
  const first = end === -1 ? text : text.slice(0, end);
  const semis = first.split(";").length - 1;
  const commas = first.split(",").length - 1;
  return semis > commas ? ";" : ",";
}
