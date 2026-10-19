# kloPIT: Project Structure & Feature Map

A quick reference guide to where things live and how features flow through the codebase.

---

## Directory Structure

```
klopit/
├── src/
│   ├── core/                     # Pure TypeScript tax domain logic (NO Svelte)
│   │   ├── index.ts              # Barrel exports
│   │   ├── types.ts              # All TypeScript types & interfaces (BrokerId, ParsedStatement, ...)
│   │   ├── nbp.ts                # NBP exchange rate fetcher
│   │   ├── parsers/
│   │   │   ├── types.ts          # ParserDefinition (CSV / PDF), StatementParser
│   │   │   ├── index.ts          # ALL_PARSERS (register new brokers here)
│   │   │   ├── registry.ts       # getParserDefinition(), supportedBrokers()
│   │   │   ├── shared/           # csv-parser.ts, csv-utils.ts
│   │   │   ├── ibkr/             # Interactive Brokers CSV: index, sections, entity-country
│   │   │   ├── ibi/              # IBI PDF: index, confirmation, espp, rsu, pdf-extract, companies, shared
│   │   │   └── schwab/           # Charles Schwab CSV (equity awards): index
│   │   ├── portfolio/
│   │   │   └── analyzer.ts       # Portfolio analysis for the dashboard
│   │   └── tax/
│   │       ├── calculator.ts     # calculateTaxes(): orchestrates the pure pipeline
│   │       ├── capital-gains.ts  # Per-account FIFO matching, cost basis, carry-ins
│   │       ├── accounts.ts       # Account keys and FIFO queue keys
│   │       ├── transfers.ts      # Account-to-account transfers of lots
│   │       ├── shortfall.ts      # Explains sells of shares an account does not hold
│   │       ├── incentive.ts      # RSU / ESPP regime: extra cost of incentive buy lots
│   │       ├── corporate-actions.ts  # Splits and mergers
│   │       ├── dividends.ts      # Dividends, withholding, treaty cap
│   │       ├── credit-interest.ts    # Broker credit interest
│   │       ├── loss-carry-forward.ts # Prior-year loss deduction (poz. 30)
│   │       ├── opp.ts            # 1.5% OPP donation
│   │       ├── pit38.ts          # PIT-38 form field builder
│   │       ├── pit-zg.ts         # PIT/ZG attachment per country
│   │       ├── aggregates.ts     # Sums, grouping, rounded payment amounts
│   │       ├── rounding.ts       # Rounding rules
│   │       ├── period.ts         # Tax-year period helpers
│   │       ├── country.ts, country-names.ts, symbol-country.ts, treaty-rates.ts
│   │       └── ...
│   │
│   ├── lib/                      # Imported as `#lib/...` (package `imports`)
│   │   ├── db.ts                 # Dexie database schema (current version v16) & initialization
│   │   ├── db-tables.ts          # INPUT_TABLES / DERIVED_TABLES classification
│   │   ├── db-migrations.ts, db-hooks.ts
│   │   ├── nav.ts                # Navigation & page metadata
│   │   ├── services/
│   │   │   ├── session.ts        # Session CRUD (create, read, update, delete)
│   │   │   ├── import.ts         # Import orchestration (parser lookup, parse, bulkAdd)
│   │   │   ├── import-files.ts   # Multi-file import wrapper used by the UI
│   │   │   ├── import-warnings.ts
│   │   │   ├── tax.ts            # Tax calculation coordination (rates -> calculator -> persist)
│   │   │   ├── rates.ts          # NBP rate cache (Dexie), fixing lookups, session prefetch
│   │   │   ├── data.ts           # Row-level CRUD (trades, dividends, etc)
│   │   │   ├── accounts.ts       # Accounts of a session
│   │   │   ├── carry-in.ts       # Carry-in positions
│   │   │   ├── incentive.ts      # RSU / ESPP regime per symbol
│   │   │   └── backup.ts         # Backup export / import (JSON, BACKUP_MIGRATIONS)
│   │   ├── utils/
│   │   │   ├── live-query.svelte.ts    # Dexie → Svelte reactivity bridge
│   │   │   ├── stale.ts          # isSessionStale()
│   │   │   ├── tax-form-status.ts # Incomplete / stale checks that block copying values
│   │   │   ├── format-pln.ts     # PLN currency formatting
│   │   │   └── ...
│   │   ├── state/                # Shared state (session.svelte.ts, theme, sidebar, logger, ...)
│   │   ├── constants/            # FAQ, acronyms, support funds
│   │   ├── components/
│   │   │   ├── ui/               # Small shared widgets (ThemeToggle, LanguagePicker, ...)
│   │   │   ├── layout/           # Header, Sidebar, Footer
│   │   │   ├── home/             # Home page blocks
│   │   │   ├── docs/             # Docs page helpers (grounding links, legal claims)
│   │   │   ├── PriorLossTable.svelte
│   │   │   └── DeleteConfirm.svelte
│   │   └── paraglide/            # Generated i18n runtime and messages (gitignored)
│   │
│   ├── routes/                   # Every route is prerendered for every locale
│   │   ├── +layout.svelte        # Root layout (nav, language switcher)
│   │   ├── +layout.ts            # Prerender config
│   │   ├── +page.svelte          # Home page
│   │   ├── about/, support/, settings/ (includes backup export / import)
│   │   ├── rates/                # NBP rates browser
│   │   ├── prior-losses/         # Prior-year losses
│   │   ├── docs/                 # Static docs: brokers, ibkr, ibi (espp, rsu), pit-38, pit-zg, faq, ...
│   │   ├── dashboard/
│   │   │   ├── +page.svelte      # Dashboard page (orchestrator)
│   │   │   ├── MetricCards.svelte
│   │   │   ├── GainsTaxDonut.svelte
│   │   │   ├── PortfolioDonut.svelte
│   │   │   ├── SymbolBarChart.svelte
│   │   │   └── ...
│   │   ├── data/
│   │   │   ├── +page.svelte      # Data page (orchestrator)
│   │   │   ├── SessionBar.svelte
│   │   │   ├── ActionBar.svelte
│   │   │   ├── ImportDialog.svelte, ImportPanel.svelte
│   │   │   ├── DataTabs.svelte
│   │   │   ├── TradesTable.svelte, TradeForm.svelte, TransferForm.svelte
│   │   │   ├── DividendsTable.svelte, WithholdingTable.svelte
│   │   │   ├── CorporateActionsTable.svelte, CarryInTable.svelte
│   │   │   ├── CreditInterestTable.svelte, CountryMappingTable.svelte
│   │   │   ├── IncentiveRegimeBar.svelte
│   │   │   └── ...
│   │   └── tax-form/
│   │       ├── +page.svelte      # Tax form page (orchestrator, auto-calc, Recalculate button, stale banner)
│   │       ├── SectionA.svelte
│   │       ├── SectionC.svelte   # Capital gains section
│   │       ├── SectionD.svelte   # Tax calculation section
│   │       ├── SectionE.svelte, SectionF.svelte  # Placeholders (crypto not calculated)
│   │       ├── SectionG.svelte   # Dividend tax section
│   │       ├── SectionH.svelte   # Monthly tax section (placeholder)
│   │       ├── PitZgView.svelte  # PIT/ZG attachment
│   │       ├── DocumentSidebar.svelte, FormField.svelte
│   │       ├── OppDonation.svelte # Charity donation input
│   │       └── ...
│   │
│   ├── app.html                  # SvelteKit HTML shell
│   ├── app.d.ts                  # SvelteKit global types
│   ├── app.css                   # Global styles
│   ├── hooks.server.ts           # Paraglide middleware (fills lang/dir at prerender)
│   └── hooks.ts                  # Paraglide reroute (de-localizes URLs)
│
├── test/
│   ├── *.test.ts                 # One file per module (core, calculator, pit38, capital-gains,
│   │                             #   per-account-fifo, transfers, incentive-*, backup, db-upgrade,
│   │                             #   ibkr*, ibi*, schwab, nbp, rates-service, rounding, ...)
│   ├── helpers/                  # fake-nbp.ts
│   └── fixtures/                 # ib/*.csv, schwab/, ibi-rsu-sample.txt
│
├── messages/
│   ├── en.json                   # English translations
│   ├── pl.json                   # Polish translations
│   └── uk.json                   # Ukrainian translations
│
├── docs/
│   ├── HOW-IT-WORKS.md           # User-friendly feature guide
│   ├── DESIGN-DECISIONS.md       # Architecture & philosophy
│   ├── ROADMAP.md                # Planned features
│   ├── CHANGELOG.md              # Release history (generated)
│   └── (this file)
│
├── examples/                     # Sample activity statement
├── static/                       # Static assets (icons, theme-init.js, robots.txt, ...)
├── scripts/                      # generate-ai-metadata.ts
├── build/                        # Pre-rendered static HTML (generated)
├── vite.config.ts                # Vite, SvelteKit (adapter, kit.csp, prerender) and Paraglide config
├── .mise.toml                    # Pinned Node 26 / pnpm 12
├── .oxlintrc.json                # oxlint config
├── .oxfmtrc.json                 # oxfmt config
├── tsconfig.json                 # TypeScript config
├── package.json                  # Dependencies, scripts, `#lib` imports
└── README.md
```

---

## Data Flow: Import → Calculate → Display

### 1. User Imports a Broker Statement (CSV or PDF)

```
User action: Click "Import" → Select file → Choose broker

↓

ImportDialog (UI)
  → calls importFiles() (import-files.ts), one file at a time → importFile()

↓

import.ts (service)
  → get ParserDefinition from registry
  → CSV parser (kind 'csv'): read file as text, createParser(),
    feed lines one-by-one, finish()
  → PDF parser (kind 'pdf'): read file as ArrayBuffer,
    parse({ buffer }) (async)
  → get ParsedStatement

↓

ParsedStatement contains:
  - trades[]
  - dividends[]
  - withholdingTaxes[]
  - corporateActions[]
  - carryInPositions[]
  - transactionFees[]
  - creditInterests[]
  - symbolToIsin (Map)
  - warnings[]
  - skippedRows[]

↓

import.ts (service)
  → validate statement
  → show warnings to user
  → bulkAdd() to IndexedDB:
    - TradeRecord[]
    - DividendRecord[]
    - CorporateActionRecord[]
    - CarryInPositionRecord[]
    - withholding taxes, transaction fees, credit interests

↓

IndexedDB updated ✓
Data page tables auto-refresh (Dexie liveQuery)
User sees trades in TradesTable
```

---

### 2. User Reviews & Edits Data

```
User action: Sees a trade, clicks Edit → Modifies → Saves

↓

TradeForm (UI)
  → calls updateTrade() from data.ts service

↓

data.ts (service)
  → db.trades.update(id, { newValues })

↓

IndexedDB updated ✓
Dexie liveQuery triggers
TradesTable re-renders
```

---

### 3. Tax Calculation (automatic, or Recalculate)

```
User action: Go to /tax-form
  - session has data but no results → calculation starts automatically
  - results exist but data changed afterwards → "stale" banner; the
    single Recalculate button in the PIT-38 header (highlighted when
    stale or incomplete) runs it again

↓

+page.svelte (orchestrator)
  → calls calculateSessionTaxes() from tax.ts service
  → while results are stale or incomplete, copying PIT-38 values is blocked
    (utils/stale.ts, utils/tax-form-status.ts)

↓

tax.ts (service)
  → query IndexedDB:
    - all trades, dividends, withholding taxes, fees, credit interests
    - corporate actions, carry-in positions, symbol country overrides
    - prior year losses (optional)
  → prefetch NBP rates (rates.ts, cached in db.nbpRates)
  → enrich trades / dividends / credit interests with NBP rates
  → call core/tax/calculator.ts

↓

calculator.ts (pure TS, no network)
  1. calculateCapitalGains() (tax/capital-gains.ts)
     - per-account FIFO queues, account transfers, carry-ins
     - incentive (RSU / ESPP) cost for incentive buy lots
     - cost basis and gain/loss per sell, in PLN

  2. calculateDividends() (tax/dividends.ts)
     - match withholding taxes, apply per-dividend treaty cap
     - PLN tax owed per dividend

  3. calculateCreditInterest()

  4. computeLossDeduction() (tax/loss-carry-forward.ts)
     - prior-year losses applied to the capital gain (poz. 30)

  5. buildSummary() → TaxSummary

  6. buildPit38() (tax/pit38.ts)
     - map amounts to form field numbers
     - rounding via tax/aggregates.ts and tax/rounding.ts

  7. buildPitZg() (tax/pit-zg.ts)

↓

Returns (TaxCalculationResult): {
  trades, dividends, creditInterests,
  summary, pit38, pitZg, lossDeduction, carryInWarnings
}

↓

tax.ts (service)
  → save to IndexedDB:
    - TaxSummaryRecord (includes pit38 fields)
    - TradeResultRecord[] (for dashboard charts)
    - DividendResultRecord[], CreditInterestResultRecord[]
  → session.calculatedAt updated

↓

IndexedDB updated ✓
Dashboard liveQuery triggers
Charts re-render with new data
Tax form page displays Pit38Fields
```

---

### 4. Dashboard Display

```
User action: Click to /dashboard

↓

+page.svelte (orchestrator)
  → query IndexedDB for:
    - TaxSummaryRecord (for metric values)
    - TradeResultRecord[] (for chart data)
    - DividendResultRecord[] (for dividend metrics)

↓

useLiveQuery() bridge
  → converts Dexie results to Svelte reactivity
  → data automatically updates if records change

↓

MetricCards.svelte
  → displays key numbers with YoY deltas

↓

GainsTaxDonut.svelte
  → visualizes: netGain vs taxOwed (donut chart)

↓

PortfolioDonut.svelte
  → visualizes: cost basis per symbol (donut chart)

↓

SymbolBarChart.svelte
  → visualizes: proceeds vs cost by symbol (bar chart)

↓

User sees dashboard ✓
```

---

## Feature Location Matrix

| Feature                | Where It Lives                                  | Entry Point                   |
| ---------------------- | ----------------------------------------------- | ----------------------------- |
| **CSV + PDF Parsers**  | `src/core/parsers/`                             | `index.ts` (`ALL_PARSERS`)    |
| **Exchange Rates**     | `src/core/nbp.ts`, `src/lib/services/rates.ts`  | Called by `tax.ts` service    |
| **FIFO Algorithm**     | `src/core/tax/capital-gains.ts`                 | Called by calculator          |
| **Account Transfers**  | `src/core/tax/transfers.ts`                     | Called by capital-gains       |
| **RSU / ESPP Regime**  | `src/core/tax/incentive.ts`                     | Called by capital-gains       |
| **Tax Calc**           | `src/core/tax/calculator.ts`                    | `tax.ts` service              |
| **Dividends**          | `src/core/tax/dividends.ts`                     | Called by calculator          |
| **Credit Interest**    | `src/core/tax/credit-interest.ts`               | Called by calculator          |
| **Loss Carry-Forward** | `src/core/tax/loss-carry-forward.ts`            | Called by calculator          |
| **PIT-38 Mapping**     | `src/core/tax/pit38.ts`                         | Called by calculator          |
| **PIT/ZG**             | `src/core/tax/pit-zg.ts`                        | Called by calculator          |
| **Rounding Rules**     | `src/core/tax/rounding.ts`, `aggregates.ts`     | Called by pit38.ts            |
| **Database Schema**    | `src/lib/db.ts`                                 | Initialized on app load       |
| **Session Service**    | `src/lib/services/session.ts`                   | Create/read/delete years      |
| **Import Service**     | `src/lib/services/import.ts`, `import-files.ts` | Upload CSV / PDF              |
| **Tax Service**        | `src/lib/services/tax.ts`                       | Auto-calc / Recalculate       |
| **Data CRUD**          | `src/lib/services/data.ts`                      | Edit/delete rows              |
| **Backup**             | `src/lib/services/backup.ts`                    | `/settings` export / import   |
| **Session State**      | `src/lib/state/session.svelte.ts`               | Shared by /data & /tax-form   |
| **i18n Messages**      | `messages/{en,pl,uk}.json`                      | Auto-loaded by Paraglide      |
| **CSP**                | `vite.config.ts` (`kit.csp`)                    | Meta tag on prerendered pages |
| **Data Page UI**       | `src/routes/data/`                              | `/data`                       |
| **Dashboard UI**       | `src/routes/dashboard/`                         | `/dashboard`                  |
| **Tax Form UI**        | `src/routes/tax-form/`                          | `/tax-form`                   |

---

## Testing Strategy

### Level 1: Core Logic (Unit Tests)

```
test/
├── *.test.ts      # One file per module, e.g.:
│                  #   core, calculator, pit38, capital-gains, per-account-fifo,
│                  #   transfers, incentive-regime, dividends, loss-carry-forward,
│                  #   rounding, nbp, rates-service, registry, ibkr, ibi, schwab,
│                  #   backup, db-upgrade, db-input-preservation, app-bundle (CSP)
├── helpers/       # fake-nbp.ts
└── fixtures/
    ├── ib/*.csv                # IBKR statements
    ├── schwab/                 # Schwab CSVs
    └── ibi-rsu-sample.txt      # IBI RSU PDF text
```

**What**: Pure `src/core/` functions with mock data  
**Tools**: Node.js `test` runner + `assert/strict`  
**Run**: `pnpm test:unit:local` (loads TypeScript via `@oxc-node/core`; plain `node --test` cannot run `.ts` files)

### Level 2: Service Integration (No full UI)

Planned future tests for:

- Session CRUD
- Import pipeline (parser → DB)
- Tax calculation flow (calculation → results stored)

### Level 3: UI/Component Tests

Planned future tests using Svelte testing utilities for:

- Page navigation
- Form submission
- Chart rendering

---

## Adding a New Feature: Example

### Scenario: Support Crypto Trades

**Files to modify:**

1. **`src/core/types.ts`**
   - Add `CryptoTrade` interface
   - Add `CryptoResult` interface
   - Update `ParsedStatement` to include `cryptoTrades[]`

2. **`src/core/parsers/ibkr/index.ts`** (or the relevant broker parser)
   - Parse crypto rows into the new `cryptoTrades[]`

3. **`src/core/tax/calculator.ts`**
   - Add `calculateCryptoTax()` function (similar to capital gains)
   - Call it from main calculator

4. **`src/core/tax/pit38.ts`**
   - Map crypto results to PIT-38(18) fields (sections E, F)

5. **`src/lib/db.ts`**
   - Add `CryptoTradeRecord` table
   - Add `CryptoResultRecord` table

6. **`src/lib/services/tax.ts`**
   - Include crypto trades in calculation

7. **`src/routes/data/`**
   - Add `CryptoTradesTable.svelte`
   - Add crypto tab to DataTabs

8. **`src/routes/tax-form/`**
   - Fill the existing `SectionE.svelte` / `SectionF.svelte` placeholders (crypto is not calculated today)

9. **`test/`**
   - Add `crypto-trades.test.ts`
   - Add `crypto-tax.test.ts`

10. **`messages/{en,pl,uk}.json`**
    - Add crypto-related i18n keys

**No changes needed to:** `ALL_PARSERS` and `BrokerId` (only a new broker touches them), `registry.ts`

---

## Dependency Graph

### External npm Packages

| Package            | Purpose                                   | Size              |
| ------------------ | ----------------------------------------- | ----------------- |
| **SvelteKit 3**    | Web framework                             | ~500 KB           |
| **Svelte 5**       | UI components (runes)                     | ~50 KB            |
| **Dexie**          | IndexedDB wrapper                         | ~30 KB            |
| **unpdf**          | PDF text extraction (IBI parser)          | —                 |
| **typeid-js**      | Record ids                                | —                 |
| **svelty-picker**  | Date/time picker                          | —                 |
| **@fontsource/\*** | Self-hosted fonts (Onest, JetBrains Mono) | —                 |
| **Paraglide JS**   | i18n (compile-time)                       | ~5 KB             |
| **Unovis**         | Charts library                            | ~800 KB           |
| **Tailwind CSS**   | Styling                                   | ~50 KB (PurgeCSS) |
| **@lucide/svelte** | Icons                                     | ~100 KB           |

### Internal Dependencies

```
UI Components
  ├── → svelte/components (Tailwind + @lucide/svelte)
  └── → #lib/services/
      ├── → #lib/db.ts (Dexie)
      ├── → #lib/utils/ (formatting, live-query bridge)
      └── → src/core/ (pure TS logic)

src/core
  ├── types.ts (no dependencies)
  ├── nbp.ts (fetch API only)
  ├── parsers/ (pure TS)
  └── tax/ (pure TS)
```

**Key principle:** `src/core/` has **zero Svelte or Node.js imports** — can be packaged as standalone library.

---

## Build & Deployment

### Development Flow

```
pnpm dev
  → Vite dev server + SvelteKit
  → Watch: src/**, messages/**
  → Auto-reload browser
  → IndexedDB works in dev
```

### Production Build

```
pnpm build
  → SvelteKit + Vite
  → Pre-render every route for every locale (en, pl, uk), plus pl/uk slug aliases
  → kit.csp emits a Content-Security-Policy <meta> tag per page
  → Output: build/
  → Minify JavaScript
  → Inline critical CSS
```

### Deployment

```
/build → GitHub Pages
  → Static files only (no server)
  → No backend; network only for uncached NBP rates (no service worker)
  → Instant load (no processing)
```

---

## Common Development Tasks

| Task          | Command                                                               | Files                               |
| ------------- | --------------------------------------------------------------------- | ----------------------------------- |
| Run tests     | `pnpm test:unit:local`                                                | `test/`                             |
| Type check    | `pnpm lint:types`                                                     | All `.ts` / `.svelte`               |
| Lint          | `pnpm lint`                                                           | svelte-check, oxlint, oxfmt --check |
| Format        | `pnpm format`                                                         | oxfmt, run manually                 |
| Build         | `pnpm build`                                                          | → `build/`                          |
| Dev server    | `pnpm dev`                                                            | → `http://localhost:5173`           |
| Generate i18n | `pnpm i18n` (or automatic via the Paraglide Vite plugin in dev/build) | → `src/lib/paraglide/` (gitignored) |

---

## Key Conventions

1. **Object arguments** (not positional):

   ```typescript
   function importTrades(args: { sessionId: string; trades: Trade[] }): void;
   ```

2. **Pure functions in `src/core/`** (no side effects, no Svelte imports)

3. **Reactive bridges in `src/lib/`** (only place Svelte ↔ DB happens)

4. **Services orchestrate** (import → parse → save → calculate)

5. **Components may read via Dexie `liveQuery`; all writes go through `src/lib/services/*`**

6. **Types are one source of truth** (`src/core/types.ts`)

---

## Glossary of Key Modules

| Module                   | Purpose                                                   |
| ------------------------ | --------------------------------------------------------- |
| **calculator.ts**        | Main tax computation: gains, dividends, tax owed          |
| **pit38.ts**             | Maps calculated results to PIT-38 form field numbers      |
| **capital-gains.ts**     | Matches sales to purchases (per-account FIFO)             |
| **backup.ts**            | Exports / imports all input data as a JSON backup         |
| **nbp.ts**               | Fetches & caches exchange rates from Polish National Bank |
| **parsers/index.ts**     | `ALL_PARSERS`: the registered broker parsers              |
| **registry.ts**          | Parser lookup (`getParserDefinition`, `supportedBrokers`) |
| **live-query.svelte.ts** | Bridges Dexie's reactive queries to Svelte components     |
| **services/import.ts**   | Orchestrates file → parse → DB insert                     |
| **services/tax.ts**      | Orchestrates: fetch rates → calculate → persist results   |
| **db.ts**                | Dexie schema definition (all tables & indexes)            |
