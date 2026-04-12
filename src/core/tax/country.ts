/** Extract ISO 3166-1 alpha-2 country code from ISIN prefix */
export function isinToCountry(args: { isin: string | undefined }): string {
  if (!args.isin || args.isin.length < 2) return 'XX';
  return args.isin.slice(0, 2).toUpperCase();
}
