export type DividendInputError =
  | 'required'
  | 'date-format'
  | 'must-be-positive'
  | 'must-be-non-negative'
  | 'withholding-exceeds-gross'
  | 'country-code'
  | 'country-required-for-withholding';

export type DividendInputField =
  | 'symbol'
  | 'date'
  | 'amount'
  | 'currency'
  | 'withholding'
  | 'country';

export const COUNTRY_CODE_RE = /^[A-Za-z]{2}$/;

/** Parsed tax withheld; `undefined` when empty, `NaN` when not a number. */
export function parseWithholding(text: string): number | undefined {
  const t = text.trim();
  return t === '' ? undefined : Number(t);
}

/**
 * Validates the manual dividend form. `countryKnown` is true when the
 * calculator can derive the dividend's country without the `country` input.
 */
export function validateDividendInput(args: {
  symbol: string;
  dateText: string;
  dateParsed: boolean;
  amount: string;
  currency: string;
  withholding: string;
  withholdingLocked: boolean;
  country: string;
  countryInputShown: boolean;
  countryKnown: boolean;
}): Partial<Record<DividendInputField, DividendInputError>> {
  const e: Partial<Record<DividendInputField, DividendInputError>> = {};
  if (!args.symbol.trim()) e.symbol = 'required';
  if (!args.dateText.trim()) e.date = 'required';
  else if (!args.dateParsed) e.date = 'date-format';
  const amount = parseFloat(args.amount);
  if (isNaN(amount) || amount <= 0) e.amount = 'must-be-positive';
  if (!args.currency.trim()) e.currency = 'required';

  const withholding = args.withholdingLocked
    ? undefined
    : parseWithholding(args.withholding);
  if (withholding !== undefined) {
    if (!Number.isFinite(withholding) || withholding < 0) {
      e.withholding = 'must-be-non-negative';
    } else if (e.amount === undefined && withholding > amount) {
      e.withholding = 'withholding-exceeds-gross';
    }
  }

  const country = args.country.trim();
  if (
    args.countryInputShown &&
    country !== '' &&
    !COUNTRY_CODE_RE.test(country)
  ) {
    e.country = 'country-code';
  } else if (
    withholding !== undefined &&
    withholding > 0 &&
    e.withholding === undefined &&
    !args.countryKnown &&
    country === ''
  ) {
    e.country = 'country-required-for-withholding';
  }
  return e;
}
