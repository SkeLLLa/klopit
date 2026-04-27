const polishRegionNames = new Intl.DisplayNames(['pl'], { type: 'region' });

export function getPolishCountryName(args: { country: string }): string {
  const code = args.country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX') return 'Nieznany kraj';
  return polishRegionNames.of(code) ?? code;
}
