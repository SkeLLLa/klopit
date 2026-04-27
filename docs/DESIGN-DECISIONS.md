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

## Design Decision: Exchange Rate Fallback to Last Known

### The Problem

NBP only provides rates for business days. What if you traded on a weekend?

### The Solution

When rate is unavailable for a date:

1. Look for the most recent business day before that date
2. Use that rate as a proxy
3. Flag it as "rate unavailable" in the results

### Why?

1. **Pragmatic**: You can't trade on weekends anyway (market closed)
2. **Conservative**: Uses older rate (usually better for tax planning)
3. **Transparent**: User sees "rate unavailable" flag and can verify

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

## Design Decision: Rounding Strategy

Rounding follows both legal tax rounding rules and the precision printed on the official PIT forms:

| Amount                        | Rule                                   | Legal basis                                                          |
| ----------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| Tax base                      | Mathematical rounding to **whole PLN** | Art. 63 § 1 — ends below 50 gr → discard, 50 gr and above → round up |
| Tax owed                      | Mathematical rounding to **whole PLN** | Art. 63 § 1 — same rule                                              |
| Dividend tax (groszy amounts) | Round **up** to full groszy            | Art. 63 § 1a — taxes in groszy are rounded up                        |
| PIT-38 fields marked `zł, gr` | Round to nearest grosz                 | Official form field precision                                        |

**Implementation:**

- `roundToFullPln()` for tax base and full-PLN tax fields such as PIT-38 poz. 31 and 35
- `roundToGrosz()` for PIT-38 fields that the official form marks as `zł, gr`, including Section C totals/gain/loss and poz. 51/52
- `roundToGroszUp()` for tax amounts that must be rounded up to groszy, including PIT-38 poz. 47 and 49

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
