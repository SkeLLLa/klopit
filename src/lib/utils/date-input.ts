const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function build(
  y: number,
  mo: number,
  d: number,
  h = 0,
  mi = 0,
  s = 0,
): Date | null {
  const date = new Date(y, mo - 1, d, h, mi, s);
  // The Date constructor silently rolls invalid parts over (Feb 30 -> Mar 2); reject that.
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  )
    return null;
  if (h > 23 || mi > 59 || s > 59) return null;
  return date;
}

/** Parse an `<input type="date">` value (YYYY-MM-DD) as local midnight. */
export function fromDateInput(v: string): Date | null {
  const match = DATE_RE.exec(v);
  if (!match) return null;
  return build(+match[1], +match[2], +match[3]);
}

/**
 * Parse an `<input type="datetime-local">` value (YYYY-MM-DDTHH:mm[:ss]) as a
 * local date.
 */
export function fromDatetimeLocal(v: string): Date | null {
  const match = DATETIME_RE.exec(v);
  if (!match) return null;
  return build(
    +match[1],
    +match[2],
    +match[3],
    +match[4],
    +match[5],
    match[6] ? +match[6] : 0,
  );
}
