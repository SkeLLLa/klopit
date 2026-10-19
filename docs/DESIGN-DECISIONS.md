# kloPIT: Design Philosophy & Key Decisions

This document explains the _why_ behind kloPIT's design — the thinking that goes into how features are organized and built.

---

## Core Philosophy: Privacy by Design

### The One Rule

**All processing and storage happens on your computer. No backend. No accounts. No tracking.**

### Why This Matters

1. **Privacy**: Your broker statements and tax data never leave your browser
2. **Simplicity**: No server to maintain, no authentication system, no payment processing
3. **Reliability**: Works offline. Works forever (as long as browsers exist)
4. **Speed**: No network latency. Calculations run instantly

### What This Means for Design

- **Data Model**: Everything fits in IndexedDB (browser local database)
- **Calculations**: Pure TypeScript functions that run in your browser's JavaScript engine
- **Exchange Rates**: Cached locally after first fetch, never synced anywhere
- **Tax Results**: Generated locally, you own the output

---

## Architecture: Three Tiers

```
┌─────────────────────────────────┐
│   UI Layer (Svelte Components)  │  ← Your experience
│   - Pages, forms, charts        │
├─────────────────────────────────┤
│ Services Layer (TypeScript)     │  ← Business logic
│   - Data import, tax calc       │
│   - Browser database operations │
├─────────────────────────────────┤
│ Core Library (Pure TypeScript)  │  ← Tax domain logic
│   - FIFO algorithm              │
│   - Tax formulas                │
│   - CSV parsers                 │
└─────────────────────────────────┘
```

### Why Three Tiers?

**Separation of concerns:**

- **UI** changes fast (design, new charts, translations)
- **Services** coordinate operations (fetch rates, save results, trigger calculations)
- **Core** is stable (tax laws don't change frequently, math is permanent)

**Benefits:**

- Core can be tested without UI
- Core logic can be reused (CLI tool, backend, other apps)
- Services can be replaced (e.g., switch IndexedDB to OPFS)
- UI can be refactored without breaking calculations

---

## Design Decision: Browser-First Storage

### Why IndexedDB, Not API Backend?

| Aspect        | IndexedDB              | Backend API                        |
| ------------- | ---------------------- | ---------------------------------- |
| Setup         | Zero (browser native)  | Servers, databases, infrastructure |
| Privacy       | ✅ Your computer only  | ⚠️ Depends on server trust         |
| Latency       | ✅ Instant             | ⚠️ Network delay                   |
| Offline       | ✅ Works               | ⚠️ Requires sync logic             |
| Cost          | ✅ Free                | ❌ Server costs, maintenance       |
| Scalability   | ⚠️ 50GB limit per user | ✅ Unlimited                       |
| Collaboration | ⚠️ Single device       | ✅ Multi-device/user               |

**Decision:** IndexedDB is the right fit because:

1. Data volume is small (50-200 trades/year = < 1MB)
2. No multi-user collaboration needed
3. Privacy is paramount
4. Users expect everything to "just work" without accounts

---

## Design Decision: No Broker Auto-Detection

### The Problem

CSV files from different brokers look different:

- Interactive Brokers: 200+ rows of mixed data
- Fidelity: Different columns, different structure
- Etc.

Auto-detecting the broker from the file is tempting but leads to:

1. False positives (wrong broker guessed)
2. Silent failures (3rd party broker silently fails)
3. Confusion (user can't debug why parsing failed)

### The Solution

**Explicit broker selection**: User picks "Interactive Brokers" before importing.

That explicit choice is paired with **fail-loud section classification** inside the parser. Once the user says "this is an IBKR statement", the app treats every IBKR section intentionally: supported sections are parsed, clearly tax-irrelevant sections are ignored, and unsupported or unknown sections are surfaced back to the user as warnings instead of being dropped silently.

**Why this is better:**

- User confirms intent ("yes, I'm uploading IB data")
- Error messages are clear ("Interactive Brokers parser failed on line 42")
- Unsupported data is visible ("Options section skipped") instead of disappearing silently
- Easy to add new brokers (just register a new parser)
- User can upload multiple file types to one session

---

## Design Decision: FIFO Over Average Cost

### The Two Methods

**Average Cost Method:**

- All shares treated as identical
- Cost = total spent / total shares
- Simple, but doesn't track history

**FIFO (First In, First Out):**

- First purchase is first sale
- Tracks exact acquisition costs
- More complex, but required by some tax authorities

### Why FIFO?

Polish tax law **requires FIFO** when specific lot identification is not possible ([art. 24 ust. 10 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/)). Since pooled brokerage accounts (like Interactive Brokers) don't allow identifying specific lots at the tax level, FIFO is the legally mandated method.

**Added benefit:** FIFO naturally tracks which shares you still own (the queue tail), useful for future features like specific lot selection.

---

## Design Decision: Carry-In Cost Basis

### The Problem

Broker statements often report shares held at the start of the year (carry-ins) without their purchase price. Earlier versions seeded them at cost 0 on the assumption that the cost was "already claimed" in prior years. That is wrong: under art. 23 ust. 1 pkt 38 with art. 30b ust. 2 pkt 1 ustawy o PIT the acquisition cost is deducted in the year of **sale**, so a zero cost silently overstates the gain and the tax.

### The Decision

- The user can enter an acquisition date and cost basis (original currency or PLN) per carry-in. Foreign-currency costs are converted at the NBP rate from the business day before acquisition (art. 11a ust. 2).
- Carry-ins are placed on the FIFO timeline at their acquisition date (art. 24 ust. 10), not in front of everything.
- Carry-ins are per-instrument snapshots of the year-end holding: only the part the imported history (and earlier snapshots) does not explain is seeded, so overlapping years and imported buys are not double counted. A snapshot below the imported holding is skipped with a warning.
- When the cost is unknown, the default status is **missing**, not zero. The calculation still runs with 0 PLN, but every affected sale is flagged on the dashboard, the Data page asks for the cost, and the tax form is marked incomplete with copying disabled.
- Zero cost is allowed only as an explicit choice for shares from a qualifying incentive program not taxed when received (art. 24 ust. 11). RSU or ESPP shares taxed at vesting or purchase have that taxed value as their cost.

### Why Not Silently Use 0?

Following the fail-loud principle (see [Fail-Loud Import Warnings](#design-decision-fail-loud-import-warnings)), a value that can make the user overpay must be visible. Blocking the calculation would be worse: users still need a draft result while they look up old purchase prices.

---

## Design Decision: Employee Incentive Shares Have No Default Regime

### The Decision

- RSU / ESPP buy lots carry a per-lot regime: `qualifying` or `taxed-at-acquisition`. Until the user picks one the lot is flagged cost-missing, so affected sales are flagged and the tax form stays a draft (copying disabled).
- Cost on sale: `qualifying` = price paid + commission; `taxed-at-acquisition` = price paid + commission + income already taxed (entered in PLN, or derived from FMV at the buy-date NBP rate).

### Why No Default?

The regime depends on facts the broker statement does not contain: whether the programme is of the company or its parent under a shareholders' resolution (art. 24 ust. 11–12b updof), and whether the vest or purchase was taxed as income (art. 23 ust. 1 pkt 38, shown on the PIT-11). Defaulting to either would silently overstate tax (zero cost when income was already taxed) or understate it (a taxed cost for a qualifying programme). This follows the fail-loud principle used for carry-in costs. The UI help text stays neutral and sends the user to their PIT-11 and employer programme.

## Design Decision: Conservative ADR/GDR Fee Treatment

### The Problem

Interactive Brokers can report ADR/GDR/CDI depositary fees in `Change in Dividend Accruals`. Some rows correspond to a dividend payment, while other rows can be a standalone account debit for a receipt that did not pay a periodic dividend.

### The Decision

kloPIT imports ADR/GDR/CDI accrual rows as transaction fees, but the default tax calculation **does not** reduce the art. 30a dividend base by those fees. A disabled-by-default setting lets a user reduce matched dividends by ADR/GDR/CDI fees when they have their own tax-advisor, prospectus, or individual-ruling basis for that treatment.

### Grounding

| Decision / assumption                                                                                                           | Grounding link                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| These rows should be imported because they represent actual ADR/GDR/CDI account fees.                                           | [IBKR Other Fees — ADR/GDR/CDI Fees](https://www.interactivebrokers.com/en/pricing/other-fees.php)                                                                                                         |
| Separate cash-account debits should not be silently netted against dividend income.                                             | [IBKR Other Fees — ADR/GDR/CDI Fees](https://www.interactivebrokers.com/en/pricing/other-fees.php)                                                                                                         |
| The safest Polish PIT default is no cost reduction for art. 30a dividend income.                                                | [PIT Act art. 30a, especially ust. 1 pkt 4 and ust. 6](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/)                                                                         |
| PIT-38 section G remains the reporting target for foreign art. 30a dividend tax and the art. 30a ust. 9 foreign-tax credit.     | [Ministry of Finance PIT-38 guidance for 2025](https://www.podatki.gov.pl/twoj-e-pit/pit-38-za-2025-rok/)                                                                                                  |
| The optional setting exists because public sources do not directly resolve every broker-reporting pattern for ADR/GDR/CDI fees. | [IBKR says to consult the ADR/GDR/CDI prospectus for fee details](https://www.interactivebrokers.com/en/pricing/other-fees.php), while Polish PIT art. 30a does not mention this broker-specific fee form. |

### Why This Is Better

- Users can see the fee instead of losing it in skipped rows.
- The default avoids making an aggressive tax-base reduction.
- Any different treatment is an explicit session setting, so exported/reviewed results can be traced back to a user decision.

---

## Design Decision: Gross Proceeds, Sell Commission as Cost

### The Problem

A sell commission can reduce the taxable gain in two equivalent ways: net it off proceeds (PIT-38 poz. 22) or count it as a cost (poz. 23). Dochód and tax are identical; only the 22/23 split differs.

### The Decision

Poz. 22 reports **gross** sale proceeds and the sell commission is added to poz. 23.

### Grounding

- The MF PIT-38 brochure for 2025 (wiersz 2, poz. 23) lists as costs "prowizje zapłacone przy kupnie i sprzedaży papierów wartościowych". Its worked example shows przychód 20 000 and koszty 10 000 + 100 commissions.
- PIT-8C (poz. 35/36) and CRS reports are gross, so a gross poz. 22 reconciles with them; a net one is what fails reconciliation.
- Trade-off: the literal art. 19 ust. 1 ("pomniejszona o koszty odpłatnego zbycia") supports netting. We follow MF practice as the least audit-contestable option.

---

## Design Decision: Rate Caching

### The Problem

Converting 50 trades from USD to PLN requires 50 NBP API calls. If you click "Calculate" twice, that's 100 calls.

### The Solution

Cache rates in IndexedDB by (date, currency) pair.

**How it works:**

1. First calculation (May): Looks up Jan 15 rate → API call → caches result
2. Second calculation (May): Looks up Jan 15 rate → uses cache → no API call
3. User imports another trade dated Jan 15: Looks up Jan 15 rate → uses cache

**Why this matters:**

- Reduces API calls by 95%+ (typical: 50 trades → 1-5 unique dates)
- NBP rates are permanent (never change )
- Users can calculate offline after initial import

**Cache clearing:** Never automatic. Users must manually clear if they suspect a stale rate (rare).

---

## Design Decision: Sessions = Tax Years

### Why Not Just "Import Files"?

Alternatives considered:

1. **One global view** — All trades ever, across years (too chaotic for tax filing)
2. **File-based** — One file = one record (confusing when importing multiple files)
3. **Auto-grouped by date** — Let app guess years (error-prone)

### Why Sessions?

A **session** is a discrete workspace for one tax year.

**Benefits:**

- Maps to your tax obligation (you file one PIT-38 per year)
- Lets you compare years (2024 vs 2025)
- Isolates calculation state
- Makes deletion safe (delete 2024 ≠ affects 2025)

**Structure per session:**

- Trades (raw, editable)
- Dividends (raw, editable)
- Results (calculated, read-only)
- Tax summary (calculated, read-only)

---

## Design Decision: Pre-Rendered Static HTML

### The Problem

Web apps typically:

- Run on a server
- Generate HTML on every request
- Require deployment infrastructure
- Need continuous uptime

### The Solution

Pre-render the app to **static HTML files** once, serve them forever.

**How it works:**

1. Build process runs the SvelteKit app
2. Generates HTML for every route (`/`, `/pl/`, `/data`, `/pl/data`, etc.)
3. Outputs plain HTML files (no server code needed)
4. Deploy to GitHub Pages (free static hosting)

**Why this is good:**

- **Fast**: Instant load (no server processing)
- **Cheap**: GitHub Pages is free
- **Reliable**: Can't crash (it's just HTML)
- **Works offline**: Download the site, works completely locally

**How data stays local:**

- IndexedDB still works in pre-rendered HTML
- JavaScript still runs in your browser
- All calculations still happen locally

---

## Design Decision: Three Languages (EN, PL, UK)

### Why Three?

1. **English** — International audience, existing documentation
2. **Polish** — Primary use case (PIT-38 is Polish tax form)
3. **Ukrainian** — Community contribution (future expansion)

### Translation Approach: Compile-Time i18n

Instead of translating strings at runtime, translations are **compiled into the HTML** by Paraglide JS.

**Example:**

- English route `/dashboard` → HTML with English text
- Polish route `/pl/dashboard` → Separate HTML with Polish text
- No language logic in the browser (faster, simpler)

**Benefits:**

- Zero translation overhead (no runtime string lookups)
- URL shows language (`/pl/` clearly means Polish)
- Easy to add new languages (just add translation file)
- Each language version can be deployed separately

---

## Design Decision: Three Pages (Not A Single Page)

### Alternative: Single Page App (SPA)

Load one page, JavaScript controls all views. Pro: feels fast.

### Reality: Multi-Page SSG

Three pre-rendered pages: `/data`, `/dashboard`, `/tax-form`.

**Why not SPA?**

1. **Data permanence**: Each navigation doesn't lose session state (URL is your state)
2. **Browser back button**: Works intuitively between pages
3. **Shareable links**: `/tax-form?year=2025` preserves context
4. **Search friendly**: Google can index all routes

**How multi-page feels fast:**

- IndexedDB syncs between pages (shared database)
- Svelte 5 reactivity makes updates instant
- Pre-rendering means no load time

---

## Design Decision: Dexie (Not Raw IndexedDB)

### The Problem

IndexedDB API is verbose and callback-heavy.

```javascript
// Raw IndexedDB (tedious)
const tx = db.transaction(['trades'], 'readwrite');
const store = tx.objectStore('trades');
const query = store.index('sessionId').getAll(sessionId);
query.onsuccess = () => {
  /* handle result */
};
```

### The Solution

Dexie.js wraps IndexedDB with a cleaner API and reactive `liveQuery`.

```typescript
// With Dexie (clean)
const trades = await db.trades.where('sessionId').equals(sessionId).toArray();
const liveQuery = db.trades.where('sessionId').equals(sessionId).toArray();
```

**Why Dexie?**

1. **Short learning curve**: SQL-like syntax
2. **Live queries**: Automatically re-run when data changes (powers reactivity)
3. **Batch operations**: Bulk insert 50 trades at once
4. **Version migrations**: Schema changes are declarative
5. **Small library**: 30 KB, no heavy dependencies

**Trade-off**: Dexie is external library, but it's mature and actively maintained.

---

## Design Decision: Svelte 5 Reactivity (Not Stores)

### Two Approaches

**Stores (old way):**

```javascript
export const trades = writable([]);
const allTrades = get(trades); // Subscribe pattern
```

**Runes (new way):**

```javascript
let trades = $state([]);         // Reactive by default
let filtered = $derived(trades.filter(...)); // Automatic recomputation
$effect(() => { /* runs when deps change */ });
```

### Why Svelte 5 Runes?

1. **Simpler syntax**: `$state` is clearer than stores
2. **Fine-grained reactivity**: Only re-render affected components
3. **Fewer concepts**: No need to learn store patterns
4. **Better TypeScript**: Runes have full type inference

---

## Design Decision: Parsed Statements Over Raw CSVs

### Pipeline

```
Raw CSV File → Parser → ParsedStatement + SkippedRow[] → IndexedDB Records + Session ImportWarnings
```

### Why Not Store Raw CSV?

1. **Duplicates**: Same trade could be in CSV twice (hard to detect)
2. **Parsing delay**: Parsing on every calc would be slow
3. **Inconsistency**: Modified trades (via edit UI) become out-of-sync with CSV
4. **Validation**: CSV parsing happens once, errors caught immediately

### Why Parse Immediately?

1. **Feedback**: User sees import warnings immediately, including unsupported or unknown IBKR sections
2. **Data quality**: Invalid rows and unsupported sections don't silently get ignored
3. **Efficiency**: Subsequent calculations don't re-parse
4. **Auditability**: The session keeps a persistent warning summary even after reload

---

## Design Decision: Fail-Loud Import Warnings

### The Problem

Broker statements mix useful rows with metadata, summaries, and sections kloPIT does not support yet. A parser that simply ignores what it does not understand is dangerous here: the user may think their entire statement was imported even when options, interest, or malformed rows were skipped.

### The Solution

The import pipeline uses a two-layer warning model:

1. The parser emits detailed `SkippedRow` entries for unsupported, unknown, or malformed rows
2. The import service groups those rows into `ImportWarning` summaries by `(section, kind)`
3. The session stores those summaries in IndexedDB so the warning banner survives reload
4. The UI keeps full skipped-row detail only in memory for the current import session

This preserves two important properties at once:

- **Persistence where it matters**: users can still see that data was skipped after a reload
- **Low storage overhead**: IndexedDB does not keep raw CSV lines for every skipped row forever

### Example

```
Interactive Brokers import warnings:
- Options: 42 rows skipped (known unsupported section)
- Unknown section 'Foobar': 3 rows skipped
- Trades: 1 row failed to parse

Detailed row inspection is available immediately after import in the Skipped tab.
```

**Benefits:**

1. User doesn't need to re-import for each issue; valid rows still import
2. Unsupported tax-relevant sections fail loud instead of disappearing silently
3. The warning banner is durable because summaries live on the session record
4. Detailed inspection stays available without bloating long-term storage

### Intentional Non-Warnings

Not every skipped IBKR row is a warning. Some rows are intentionally filtered because they are redundant or outside scope:

- `Header`, `SubTotal`, and `Total` row types
- Per-section summary rows like `Total in EUR`
- Statement metadata sections such as account information and legal notes
- Non-stock rows inside stock-only import paths

Warnings are reserved for rows the user may reasonably expect to matter for tax reporting.

---

## Design Decision: Exchange Rate Lookup and Unavailable Rates

### The Problem

Art. 11a updof requires the NBP average rate from the **last business day before** the event date. NBP publishes table A only on business days, around midday Warsaw time, and its API rejects (HTTP 400) any range ending after today. So the rate for "today" is not known until midday, and rates for future days (e.g. an estimated T+2 settlement date) do not exist yet.

### The Solution

1. **Normal walk back**: starting from the day before the reference date, skip weekends and NBP holidays (days with no table) until a published rate is found, at most 14 days back. This is the regular art. 11a lookup, not a fallback.
2. **Today and future are never assumed**: requests are clamped to today (Europe/Warsaw). If the required business day is today (before publication) or in the future, the lookup fails with "not yet published" instead of walking back to an older, legally wrong rate.
3. **Failure is flagged, not filled**: when no rate can be resolved, the row gets `rateUnavailable` and is computed with rate 0. The summary counts such rows (`missingRateCount`); when it is above 0 the dashboard shows a warning, the tax form shows a red banner and a "Draft — incomplete" state, and copying PIT-38 values is disabled until a recalculation succeeds. A missing rate on a buy is carried on its FIFO lot to every sell that consumes it (`costRateUnavailable`). There is no "last known rate" fallback.
4. **Cache semantics**: a day without a rate is cached as `rate: null` only when it is strictly before the day it was fetched (`fetchedAt > date`), i.e. a real weekend or holiday. Today and future days are never cached as missing, and `null` records without a later `fetchedAt` (legacy) are refetched. DB v15 dropped all previously cached `null` entries.

### Why?

1. **Legally correct**: a missing table for today means "not yet known", not a holiday. Using the previous day's rate would silently misstate PLN amounts.
2. **Safe direction**: a sell with rate 0 has 0 PLN proceeds, which understates tax. Blocking export makes sure such results are not filed.
3. **Self-healing**: recalculating after publication picks up the correct rate without clearing the cache.

---

## Design Decision: 19% Flat Tax (Not Progressive)

### The Polish Rules

- Capital gains in Poland: 19% **flat rate** (not progressive)
- Dividends: 19% **flat rate**
- Crypto: 19% flat rate (as of 2024)

### Why This Matters

Can't use progressive tax brackets (which would require income info outside scope of app).

**Simplification:** You tell us your gains, we calculate 19% automatically.

---

## Design Decision: ADR: dividend country ≠ gains country; PIL country = withholding country

**Problem:** An ADR such as TSM (`US8740391003`) resolved to US from its ISIN, giving the wrong treaty cap and a false W-8BEN lapse warning on its dividends. Payments in lieu of dividends (lent shares) were mixed into ordinary dividend events.

**Decision:**

- Art. 30a ust. 9 updof credits dividend tax by the treaty with the source state, which for an ADR is the issuer's residence. Capital gains (art. 30b) and PIT/ZG keep the ISIN-prefix country. The calculation therefore builds two maps, `gains` and `dividends`; `dividends` adds the ADR issuer country.
- The IBKR parser marks ADRs from the `Type` column and learns the issuer country from the `- XX Tax` suffix of ordinary-dividend withholding rows, stored as non-indexed `isAdr` / `adrCountry` fields on dividend rows. Conflicting suffixes keep the ISIN country and warn rather than guess.
- Country overrides carry a non-indexed `scope` (`dividends` | `gains` | `both`; missing = `both`), so existing overrides keep their meaning and a dividend override doesn't move gains.
- Payments in lieu get `kind: 'payment-in-lieu'` and are separate events. Their country is the withholding country (`taxCountry`), falling back to the ISIN country; a user override always wins, except for payments in lieu, whose country is the state that withheld the tax (a US-withheld PIL is capped by the US treaty, not by an override to another state); they never feed ADR learning, get no W-8BEN warning, and always carry an informational "substitute payment" warning. The classification of PIL as a dividend for PIT-38 is flagged for the user to verify, not decided by kloPIT.

**Trade-offs:** The ADR country lives on dividend rows only, so rows imported before this change need a re-import (legacy rows without `kind` count as ordinary dividends, so legacy payments in lieu are only separated after a re-import). The PIT/ZG "required only with foreign tax" labelling is covered in the next decision.

---

## Design Decision: PIT/ZG required only when foreign tax is credited

**Problem:** `buildPitZg` produced a PIT/ZG for every country with sell trades, implying one attachment per country.

**Decision:**

- PIT/ZG is required only for foreign income to which the foreign-tax-credit method applies (art. 30b ust. 5a/5b updof; MF "Broszura do PIT-38 za 2025 r.", Część L; PIT/ZG(8) header). Share gains are normally taxable only in Poland under the treaties (OECD MC art. 13 ust. 5), but because kloPIT never records foreign tax on gains (`foreignTaxPln` is always 0) the UI says "no foreign tax on capital gains recorded", not "taxed only in Poland".
- `PitZgFields.required = creditableForeignTaxPln > 0`, where the credit is the paid foreign tax capped by 19% of the country gain (art. 30b ust. 5a) and proportionally by the Polish tax due after offsets and loss carry-forward (`summary.capitalGainTaxPostLcfPln`). A credit of 0 therefore means not required (net loss, overall loss, carry-forward to 0). Not-required countries stay in the result, shown muted, and `requiredPitZg()` returns the filing list.
- Dividend rows (optional compatibility setting) are never required and carry their own notice: PIT/ZG C.3 covers art. 30b only; dividends are credited in PIT-38 section G (art. 30a). The setting is labelled "informational".

**Trade-offs:** The per-country split of the Polish tax is proportional to country gains, an approximation of the ust. 5a limit. Until a source of foreign tax on gains exists, every gains row is informational.

---

## Design Decision: Rounding Strategy

Rounding follows both legal tax rounding rules and the precision printed on the official PIT forms:

| Amount                                    | Rule                                   | Legal basis                                                                         |
| ----------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------- |
| Tax base, capital gains tax due           | Mathematical rounding to **whole PLN** | Art. 63 § 1 OP — ends below 50 gr → discard, 50 gr and above → round up             |
| Dividend tax due (poz. 49, dividend part) | Mathematical rounding to **whole PLN** | Art. 63 § 1 OP — dividends are art. 30a ust. 1 pkt 4, outside § 1a                  |
| Interest tax (poz. 47/49, interest part)  | Round **up** to full groszy            | Art. 63 § 1a OP — covers only art. 30a ust. 1 pkt 1–3 (interest is pkt 3); base too |
| PIT-38 fields marked `zł, gr`             | Round to nearest grosz                 | Official form field precision                                                       |

PIT-38 Section G is computed **per component** and poz. 49 is the sum of the
two parts. The MF PIT-38 (2025) guide, part G, says amounts in poz. 46 and 49
are given in full złoty, with the exception in art. 63 § 1a OP for art. 30a
ust. 1 pkt 1–3 income, which is rounded up to full groszy. Art. 63 § 1a does
**not** cover pkt 4 (dividends), so the dividend difference is rounded half-up
to whole złoty. Each foreign-tax credit is capped at its own part (art. 30a
ust. 9). The calculation lives in `sectionGForeignFlatTax()`; the tax-form UI
shows core values as given and does not re-round.

The dividend part is deliberately rounded twice: poz. 47 and 48 are `zł, gr`
amounts, so tax and credit are rounded to the grosz first, and poz. 49 is the
difference "po zaokrągleniu do pełnych złotych" (e.g. 2.6053 zł of dividends →
poz. 47 = 0.50 → poz. 49 = 1). Inputs to `sectionGForeignFlatTax()` are clamped
at 0.

**Implementation:**

- `roundToFullPln()` for tax base and full-PLN tax fields such as PIT-38 poz. 31, 35 and the dividend part of poz. 49
- `roundToGrosz()` for PIT-38 fields that the official form marks as `zł, gr`, including Section C totals/gain/loss, the dividend tax/credit parts and poz. 51/52
- `roundToGroszUp()` for the interest part (art. 30a ust. 1 pkt 3) of poz. 47 and 49

---

## Design Decision: Prior Year Loss Limits

### Polish Rules

- Carry losses forward up to **5 years**
- Use max **50% per year** (the other 50% rolls forward)

**Example:**

```
2020 loss: -$100K
2021: use $50K (50% of loss), $50K stays
2022: use $50K (rest of 2020), can use $50K of 2021 loss (50%)
2023: can use $50K of 2021 loss (rest)
2024: 2020 loss expired (5 years up), can still use 2021 loss (only 4 years old)
2025: 2021 loss expires (5 years up)
```

**Implementation:**

- User enters prior year loss amount manually
- App ensures 50% limit per year
- The per-year cap is rounded **down** to the grosz, so poz. 30 never exceeds 50% of the loss (rounding to nearest could overshoot by half a grosz)
- Stores "loss used" and "loss remaining" separately

---

## Design Decision: Component Organization (Data, Dashboard, Form)

### Three Top-Level Routes

1. **`/data`** — CRUD, raw tables, imports
2. **`/dashboard`** — Metrics, charts, summaries
3. **`/tax-form`** — Form fields, calculated results, export

**Why not combine?**

1. **Cognitive load**: Too much in one page
2. **Workflow**: Import → Review → Calculate → File (sequential)
3. **Mobile friendly**: Each page is simpler to layout
4. **Modular**: Each page is independently testable

---

## Design Decision: Per-Account FIFO; Transfers Never Auto-Inferred

### Decision

FIFO queues are kept per securities account (`account|ISIN-or-symbol`), as art. 24 ust. 10 updof requires ("odrębnie dla każdego rachunku papierów wartościowych"). Specific identification inside an account (IBI lot id) is kept (KIS 0112-KDWL.4011.2.2025.1.TW).

### Why not infer transfers

When a sell exceeds an account's holding while another account held the instrument, a transfer is likely, but the app only _suggests_ it (`transfer-suggested`). A transfer changes which lots (and costs) a later sell consumes, so guessing it silently could understate or overstate tax. The missing shares cost 0, the result is a draft, and the user decides (a shortfall with no donor account suggests adding a carry-in).

### Legacy rows

Rows without an account join the only account of the session (identical results). With several accounts they join the one account that holds the instrument; otherwise they go to `__unassigned__` (shown as "Unassigned"), and the form is a draft only if several accounts hold the instrument. A shortfall taints its queue: later sells are drafts too, so a pre-period gap cannot yield a silently final form.

---

## Design Decision: Live Dashboard (Not Screenshots)

### Alternative: Static Report

Generate a PDF report once, user downloads it.

### Reality: Live Dashboard

Dashboard re-renders as you edit trades (real-time reaction).

**Why?**

1. **Confidence**: See immediately how a trade change affects your taxes
2. **Experimentation**: "What if I delete this trade?" → instant visual feedback
3. **Debugging**: Hover over a chart label and see the exact trade
4. **Modern UX**: Matches user expectations (live spreadsheets, modern apps)

---

## Future Flexibility Built In

### Designed for Addition

1. **Broker registry**: Add new parsers without modifying existing code
2. **Currency support**: Easy to add EUR, GBP, etc. (infrastructure in place)
3. **Asset types**: Crypto framework exists, just needs implementation
4. **Export formats**: Can export to XML, JSON, PDF (adapter pattern exists)
5. **Multi-language**: Adding languages is just adding a JSON file

### Designed for Replacement

1. **Storage**: Could replace IndexedDB with SQLite WASM
2. **UI framework**: SvelteKit is frontend-agnostic (calcs work standalone)
3. **Parser library**: Could be used in CLI tool or Node.js app

---

## Summary: Design Principles

| Principle                | Example                                                   |
| ------------------------ | --------------------------------------------------------- |
| **Privacy by default**   | No backend, all stored locally                            |
| **User control**         | Explicit broker selection, no auto-magic                  |
| **Transparency**         | Show parse warnings, rate lookup status, rounding applied |
| **Resilience**           | Cache rates, collect all errors before failing            |
| **Simplicity**           | Three pages, one session per year, one tax rate (19%)     |
| **Flexibility**          | Parser registry, adapter patterns, pure core logic        |
| **Standards compliance** | FIFO method, PIT-38 fields, NBP rates, Polish tax rules   |
