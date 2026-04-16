/**
 * Maps known IBKR legal entity names (from CSV `Statement,Data,BrokerName`)
 * to ISO 3166-1 alpha-2 country codes.
 *
 * The entity determines the source country for credit interest income and
 * therefore which tax treaty applies for withholding tax purposes.
 */
const IBKR_ENTITY_COUNTRY_MAP: ReadonlyMap<string, string> = new Map([
  ['Interactive Brokers LLC', 'US'],
  ['Interactive Brokers Ireland Limited', 'IE'],
  ['Interactive Brokers Central Europe Zrt.', 'HU'],
  ['Interactive Brokers (U.K.) Limited', 'GB'],
  ['Interactive Brokers Hong Kong Limited', 'HK'],
  ['Interactive Brokers Securities Japan Inc.', 'JP'],
  ['Interactive Brokers Australia Pty. Ltd.', 'AU'],
  ['Interactive Brokers Canada Inc.', 'CA'],
  ['Interactive Brokers (India) Pvt. Ltd.', 'IN'],
  ['Interactive Brokers Singapore Pte. Ltd.', 'SG'],
]);

/** Resolve IBKR entity name to country code, or undefined if unknown. */
export function ibkrEntityToCountry(args: {
  brokerName: string;
}): string | undefined {
  return IBKR_ENTITY_COUNTRY_MAP.get(args.brokerName.trim());
}
