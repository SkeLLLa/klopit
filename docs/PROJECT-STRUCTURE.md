# kloPIT: Project Structure & Feature Map

A quick reference guide to where things live and how features flow through the codebase.

---

## Directory Structure

```
klopit/
├── src/
│   ├── core/                     # Pure TypeScript tax domain logic (NO Svelte)
│   │   ├── index.ts              # Barrel exports
│   │   ├── types.ts              # All TypeScript types & interfaces
│   │   ├── nbp.ts                # NBP exchange rate fetcher & cache
│   │   ├── parsers/
│   │   │   ├── types.ts          # Parser interfaces
│   │   │   ├── registry.ts       # Broker parser registry
│   │   │   ├── csv-parser.ts     # Base class for CSV parsers
│   │   │   ├── interactive-brokers.ts  # IB-specific parser
│   │   │   └── ...
│   │   ├── portfolio/
│   │   │   ├── fifo.ts           # FIFO matching algorithm
│   │   │   └── ...
│   │   └── tax/
│   │       ├── calculator.ts     # Main tax calculation function
│   │       ├── pit38.ts          # PIT-38 form field builder
│   │       ├── rounding.ts       # Rounding rules
│   │       └── ...
│   │
│   ├── lib/
│   │   ├── db.ts                 # Dexie database schema & initialization
│   │   ├── nav.ts                # Navigation & page metadata
│   │   ├── services/
│   │   │   ├── session.ts        # Session CRUD (create, read, update, delete)
│   │   │   ├── import.ts         # CSV import orchestration
│   │   │   ├── tax.ts            # Tax calculation coordination
│   │   │   └── data.ts           # Row-level CRUD (trades, dividends, etc)
│   │   ├── utils/
│   │   │   ├── live-query.svelte.ts    # Dexie → Svelte reactivity bridge
│   │   │   ├── format-pln.ts    # PLN currency formatting
│   │   │   └── ...
│   │   ├── state/
│   │   │   └── session.svelte.ts # Shared session state (for data + tax-form)
│   │   ├── components/
│   │   │   ├── SessionSelector.svelte
│   │   │   ├── BrokerSelect.svelte
│   │   │   └── ...
│   │   └── paraglide/
│   │       ├── messages.js       # Generated i18n messages
│   │       └── ...
│   │
│   ├── routes/
│   │   ├── +layout.svelte        # Root layout (nav, language switcher)
│   │   ├── +layout.ts            # Prerender config
│   │   ├── +page.svelte          # Home page
│   │   ├── about/
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
│   │   │   ├── ImportDialog.svelte
│   │   │   ├── DataTabs.svelte
│   │   │   ├── TradesTable.svelte
│   │   │   ├── TradeForm.svelte
│   │   │   ├── DividendsTable.svelte
│   │   │   ├── WithholdingTable.svelte
│   │   │   ├── CorporateActionsTable.svelte
│   │   │   ├── CarryInTable.svelte
│   │   │   └── ...
│   │   └── tax-form/
│   │       ├── +page.svelte      # Tax form page (orchestrator)
│   │       ├── SectionC.svelte   # Capital gains section
│   │       ├── SectionD.svelte   # Tax calculation section
│   │       ├── SectionG.svelte   # Dividend tax section
│   │       ├── SectionH.svelte   # Monthly tax section (placeholder)
│   │       ├── OppDonation.svelte # Charity donation input
│   │       └── ...
│   │
│   ├── app.html                  # SvelteKit HTML shell
│   ├── app.d.ts                  # SvelteKit global types
│   ├── app.css                   # Global styles
│   └── hooks.ts                  # Paraglide i18n hooks
│
├── test/
│   ├── core.test.ts              # Generic core tests
│   ├── calculator.test.ts        # Tax calculation tests
│   ├── pit38.test.ts             # PIT-38 form field tests
│   ├── capital-gains.test.ts     # Gains/losses tests
│   ├── dividends.test.ts         # Dividend tax tests
│   ├── fifo.test.ts              # FIFO algorithm tests
│   ├── interactive-brokers.test.ts # IB parser tests
│   ├── nbp.test.ts               # Rate fetching tests
│   ├── rounding.test.ts          # Rounding edge cases
│   ├── fixtures/
│   │   └── ib/
│   │       └── sample-statement.csv # Test CSV sample
│   └── ...
│
├── messages/
│   ├── en.json                   # English translations
│   ├── pl.json                   # Polish translations
│   └── uk.json                   # Ukrainian translations
│
├── docs/
│   ├── HOW-IT-WORKS.md           # User-friendly feature guide
│   ├── DESIGN-DECISIONS.md       # Architecture & philosophy
│   ├── (this file)
│   ├── superpowers/
│   │   ├── plans/                # Implementation plans for features
│   │   └── specs/                # Detailed architecture specs
│   └── ...
│
├── build/                        # Pre-rendered static HTML (generated)
├── svelte.config.js              # SvelteKit config
├── vite.config.ts                # Vite/Paraglide config
├── tsconfig.json                 # TypeScript config
├── package.json                  # Dependencies
└── README.md
```

---

## Data Flow: Import → Calculate → Display

### 1. User Imports Broker CSV

```
User action: Click "Import" → Select file → Choose broker

↓

ImportDialog (UI)
  → calls importFile() service

↓

import.ts (service)
  → read file as text
  → get ParserDefinition from registry
  → create parser instance
  → feed lines one-by-one
  → get ParsedStatement

↓

ParsedStatement contains:
  - trades[]
  - dividends[]
  - withholdingTaxes[]
  - corporateActions[]
  - carryInPositions[]
  - warnings[]

↓

import.ts (service)
  → validate statement
  → show warnings to user
  → bulkAdd() to IndexedDB:
    - TradeRecord[]
    - DividendRecord[]
    - CorporateActionRecord[]
    - CarryInPositionRecord[]

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

### 3. User Clicks "Calculate Taxes"

```
User action: Go to /tax-form → Click "Calculate"

↓

+page.svelte (orchestrator)
  → calls calculateTaxes() from tax.ts service

↓

tax.ts (service)
  → query IndexedDB:
    - all trades for session
    - all dividends for session
    - prior year loss (optional)
  → call core/tax/calculator.ts

↓

calculator.ts (pure TS)
  1. Fetch NBP rates (via nbp.ts)
     - Use cache if available
     - Fallback to last business day
     - Store in cache

  2. Convert all trades to PLN
     - Use historical NBP rate from trade date

  3. Enrich trades with computed fields
     - FIFO match for each sell (via portfolio/fifo.ts)
     - Calculate cost basis
     - Calculate gain/loss

  4. Sum trades by type (gains/losses)

  5. Calculate capital gains tax
     - totalGain × 19%
     - Apply rounding rules

  6. Enrich dividends with computed fields
     - converted to PLN
     - match withholding taxes
     - calculate PLN owed

  7. Calculate dividend tax
     - totalDividends × 19% = total tax
     - minus foreign withholding
     - result = tax owed to Poland

  8. Apply prior year losses (if any)
     - cap at 50% per year
     - reduce tax base

  9. Build Pit38Fields
     - map all amounts to form field numbers
     - apply final rounding

↓

Returns: {
  tradeResults: TradeResult[],
  dividendResults: DividendResult[],
  taxSummary: TaxSummary,
  pit38Fields: Pit38Fields
}

↓

tax.ts (service)
  → save to IndexedDB:
    - TaxSummaryRecord
    - TradeResultRecord[] (for dashboard charts)
    - DividendResultRecord[]
    - pit38Fields (inside TaxSummaryRecord)

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

| Feature             | Where It Lives                    | Entry Point                 |
| ------------------- | --------------------------------- | --------------------------- |
| **CSV Parser**      | `src/core/parsers/`               | `registry.ts`               |
| **Exchange Rates**  | `src/core/nbp.ts`                 | Called by calculator        |
| **FIFO Algorithm**  | `src/core/portfolio/fifo.ts`      | Called by calculator        |
| **Tax Calc**        | `src/core/tax/calculator.ts`      | `tax.ts` service            |
| **PIT-38 Mapping**  | `src/core/tax/pit38.ts`           | Called by calculator        |
| **Rounding Rules**  | `src/core/tax/rounding.ts`        | Called by pit38.ts          |
| **Database Schema** | `src/lib/db.ts`                   | Initialized on app load     |
| **Session Service** | `src/lib/services/session.ts`     | Create/read/delete years    |
| **Import Service**  | `src/lib/services/import.ts`      | Upload CSV                  |
| **Tax Service**     | `src/lib/services/tax.ts`         | Calculate button            |
| **Data CRUD**       | `src/lib/services/data.ts`        | Edit/delete rows            |
| **Session State**   | `src/lib/state/session.svelte.ts` | Shared by /data & /tax-form |
| **i18n Messages**   | `messages/{en,pl,uk}.json`        | Auto-loaded by Paraglide    |
| **Data Page UI**    | `src/routes/data/`                | `/data`                     |
| **Dashboard UI**    | `src/routes/dashboard/`           | `/dashboard`                |
| **Tax Form UI**     | `src/routes/tax-form/`            | `/tax-form`                 |

---

## Testing Strategy

### Level 1: Core Logic (Unit Tests)

```
test/
├── core.test.ts           # Types & utility functions
├── calculator.test.ts     # Tax calculation (gains, dividends, tax owed)
├── pit38.test.ts          # PIT-38 field mapping
├── capital-gains.test.ts  # Specific gain/loss scenarios
├── dividends.test.ts      # Dividend + withholding tax
├── fifo.test.ts           # FIFO matching algorithm
├── rounding.test.ts       # Rounding edge cases (PLN, groszy)
├── nbp.test.ts            # Rate fetching & caching
├── interactive-brokers.test.ts  # IB CSV parser
└── fixtures/
    └── ib/
        └── sample-statement.csv   # Test data
```

**What**: Pure `src/core/` functions with mock data  
**Tools**: Node.js `test` runner + `assert/strict`  
**Run**: `node --test test/*.test.ts`

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

2. **`src/core/parsers/interactive-brokers.ts`**
   - Add `parseCryptoTrade()` method
   - Handle crypto rows in `processRow()`

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
   - Add `SectionE.svelte` (crypto gains)
   - Add `SectionF.svelte` (crypto tax)

9. **`test/`**
   - Add `crypto-trades.test.ts`
   - Add `crypto-tax.test.ts`

10. **`messages/{en,pl,uk}.json`**
    - Add crypto-related i18n keys

**No changes needed to:** Parser registry, core interfaces (already extensible)

---

## Dependency Graph

### External npm Packages

| Package           | Purpose               | Size              |
| ----------------- | --------------------- | ----------------- |
| **SvelteKit**     | Web framework         | ~500 KB           |
| **Svelte 5**      | UI components (runes) | ~50 KB            |
| **Dexie**         | IndexedDB wrapper     | ~30 KB            |
| **Paraglide JS**  | i18n (compile-time)   | ~5 KB             |
| **Unovis**        | Charts library        | ~800 KB           |
| **Tailwind CSS**  | Styling               | ~50 KB (PurgeCSS) |
| **lucide-svelte** | Icons                 | ~100 KB           |

### Internal Dependencies

```
UI Components
  ├── → svelte/components (Tailwind + lucide-svelte)
  └── → $lib/services/
      ├── → $lib/db.ts (Dexie)
      ├── → $lib/utils/ (formatting, live-query bridge)
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
  → Pre-render all routes (3 langs × 5 pages = 15 static HTMLs)
  → Output: build/
  → Minify JavaScript
  → Inline critical CSS
```

### Deployment

```
/build → GitHub Pages
  → Static files only (no server)
  → Works offline
  → Instant load (no processing)
```

---

## Common Development Tasks

| Task          | Command                      | Files                     |
| ------------- | ---------------------------- | ------------------------- |
| Run tests     | `node --test test/*.test.ts` | `test/`                   |
| Type check    | `svelte-check`               | All `.ts` / `.svelte`     |
| Lint          | `eslint .`                   | Checks all code           |
| Format        | `prettier --write .`         | Auto-run by hooks         |
| Build         | `pnpm build`                 | → `build/`                |
| Dev server    | `pnpm dev`                   | → `http://localhost:5173` |
| Generate i18n | (automatic)                  | → `src/lib/paraglide/`    |

---

## Key Conventions

1. **Object arguments** (not positional):

   ```typescript
   function importTrades(args: { sessionId: string; trades: Trade[] }): void;
   ```

2. **Pure functions in `src/core/`** (no side effects, no Svelte imports)

3. **Reactive bridges in `src/lib/`** (only place Svelte ↔ DB happens)

4. **Services orchestrate** (import → parse → save → calculate)

5. **Components never do DB operations directly** (always via services)

6. **Types are one source of truth** (`src/core/types.ts`)

---

## Glossary of Key Modules

| Module                   | Purpose                                                   |
| ------------------------ | --------------------------------------------------------- |
| **calculator.ts**        | Main tax computation: gains, dividends, tax owed          |
| **pit38.ts**             | Maps calculated results to PIT-38 form field numbers      |
| **fifo.ts**              | Matches sales to purchases (first-in-first-out)           |
| **nbp.ts**               | Fetches & caches exchange rates from Polish National Bank |
| **registry.ts**          | Broker parser lookup table                                |
| **live-query.svelte.ts** | Bridges Dexie's reactive queries to Svelte components     |
| **service/import.ts**    | Orchestrates CSV → Parse → DB insert                      |
| **service/tax.ts**       | Orchestrates: fetch rates → calculate → persist results   |
| **db.ts**                | Dexie schema definition (all tables & indexes)            |
