/**
 * In-memory stand-in for the NBP rates API (api.nbp.pl), so tests never hit the
 * network. Mirrors the real API's behaviour around "today":
 *
 * - 400 for any range (or single date) ending after `today`
 * - 404 when the range holds no published rate
 * - 200 with the published rates otherwise
 */

export type FetchInput = Parameters<typeof fetch>[0];

export function urlOf(input: FetchInput): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

export function nbpBadRange(): Response {
  return new Response(
    '400 BadRequest - Błędny zakres dat / Invalid date range',
    { status: 400 },
  );
}

export function nbpOk(
  code: string,
  rates: { effectiveDate: string; mid: number }[],
): Response {
  return Response.json({
    table: 'A',
    currency: code,
    code,
    rates: rates.map((r, i) => ({ no: `${String(i)}/A/NBP/2026`, ...r })),
  });
}

/** Parse `{currency, start, end}` from an NBP rates URL. */
export function parseNbpUrl(input: FetchInput): {
  currency: string;
  start: string;
  end: string;
} {
  const m =
    /\/rates\/a\/([a-z]{3})\/(\d{4}-\d{2}-\d{2})\/(?:(\d{4}-\d{2}-\d{2})\/)?/i.exec(
      urlOf(input),
    );
  if (!m) throw new Error(`unexpected NBP url: ${urlOf(input)}`);
  // The end-date group is optional; `.at()` types it as possibly undefined.
  return { currency: m[1].toUpperCase(), start: m[2], end: m.at(3) ?? m[2] };
}

/**
 * Build a `fetch` replacement emulating NBP. `today` and `rates` are read on
 * every call, so tests can mutate them (e.g. publish today's table later).
 * Every requested URL is appended to `requests`.
 */
export function fakeNbp(state: {
  today: string;
  rates: Record<string, number>;
  requests?: string[];
  failCurrencies?: string[];
}): (input: FetchInput) => Promise<Response> {
  return async (input) => {
    state.requests?.push(urlOf(input));
    const { currency, start, end } = parseNbpUrl(input);
    if (state.failCurrencies?.includes(currency)) {
      return new Response('500 Internal Server Error', { status: 500 });
    }
    if (end > state.today || start > end) return nbpBadRange();
    const hits = Object.entries(state.rates)
      .filter(([d]) => d >= start && d <= end)
      .map(([effectiveDate, mid]) => ({ effectiveDate, mid }));
    return hits.length > 0
      ? nbpOk(currency, hits)
      : new Response('404 NotFound - Brak danych', { status: 404 });
  };
}
