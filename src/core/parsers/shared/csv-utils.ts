/** Parse a CSV line per RFC 4180 — handles quoted fields, escaped quotes, commas inside quotes */
export function parseCsvLine(args: { line: string }): string[] {
  let { line } = args;

  // Strip BOM
  if (line.charCodeAt(0) === 0xfeff) {
    line = line.slice(1);
  }

  const fields: string[] = [];
  let i = 0;

  while (i <= line.length) {
    if (i === line.length) {
      // Trailing comma produced an empty field
      fields.push('');
      break;
    }

    if (line[i] === '"') {
      // Quoted field
      let value = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            // Escaped quote
            value += '"';
            i += 2;
          } else {
            // Closing quote
            i++; // skip closing quote
            break;
          }
        } else {
          value += line[i];
          i++;
        }
      }
      fields.push(value);
      // Skip comma after quoted field
      if (i < line.length && line[i] === ',') {
        i++;
      } else {
        break;
      }
    } else {
      // Unquoted field
      const commaIdx = line.indexOf(',', i);
      if (commaIdx === -1) {
        fields.push(line.slice(i));
        break;
      } else {
        fields.push(line.slice(i, commaIdx));
        i = commaIdx + 1;
      }
    }
  }

  return fields;
}

/** Trim whitespace and strip surrounding quotes */
export function cleanField(args: { value: string }): string {
  let v = args.value.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    v = v.slice(1, -1);
  }
  return v;
}

/** Parse a decimal number, handling comma as thousands separator. Returns undefined on failure. */
export function parseDecimal(args: { value: string }): number | undefined {
  const trimmed = args.value.trim();
  if (trimmed === '') return undefined;

  // Remove commas used as thousands separators (e.g., "1,234.56")
  const cleaned = trimmed.replace(/,/g, '');
  const num = Number(cleaned);
  return Number.isNaN(num) ? undefined : num;
}

/** Parse a date/time string. Tries IB formats in order. Returns undefined on failure. */
export function parseDateTime(args: { value: string }): Date | undefined {
  const v = args.value.trim();
  if (v === '') return undefined;

  // Format 1: "yyyy-MM-dd, HH:mm:ss" (IB quoted datetime with comma)
  const commaMatch =
    /^(\d{4})-(\d{2})-(\d{2}),\s*(\d{2}):(\d{2}):(\d{2})$/.exec(v);
  if (commaMatch) {
    const [, year, month, day, hour, min, sec] = commaMatch;
    const d = new Date(+year, +month - 1, +day, +hour, +min, +sec);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  // Format 2: "yyyy-MM-dd HH:mm:ss"
  const spaceMatch = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(
    v,
  );
  if (spaceMatch) {
    const [, year, month, day, hour, min, sec] = spaceMatch;
    const d = new Date(+year, +month - 1, +day, +hour, +min, +sec);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  // Format 3: "yyyy-MM-dd"
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const d = new Date(+year, +month - 1, +day);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  return undefined;
}
