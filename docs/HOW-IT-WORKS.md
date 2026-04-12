# kloPIT: How It Works

A comprehensive guide to understanding kloPIT's logic and features, explained in human terms.

---

## What is kloPIT?

kloPIT is a **Polish tax calculator for brokerage income** — specifically for reporting investment gains and dividends on the **PIT-38 tax form**. It's entirely web-based and works **completely in your browser** with no server involved.

### Key principle

**All your data stays on your computer.** The app:

- Reads your broker statements (CSV files)
- Calculates your taxes locally
- Stores everything in your browser's database
- Never sends anything to a server

---

## Main Workflow

```
Step 1: Import             Step 2: Organize          Step 3: Calculate         Step 4: Review
Broker CSV file    →       Parse data into           Fetch exchange rates,     View dashboard,
(trades, dividends)        categories                apply FIFO method,        tax form,
                           Store in database         compute taxes             export results
```

### Example: You sell 100 Apple shares

1. **Import phase:** The system reads your Interactive Brokers CSV and finds the trade record
2. **Organize phase:** Data is stored with metadata (dates, amounts, currencies)
3. **Calculate phase:**
   - Converts USD amounts to PLN using NBP exchange rates
   - Applies FIFO: matches your sale with your oldest purchase
   - Calculates your capital gain
   - Computes 19% tax owed
4. **Review phase:** You see results in the dashboard, then fill out PIT-38

---

## The Three Main Pages

### 1. Data Page (`/data`)

**Purpose:** Manage your import sessions, review raw data, edit entries

**What you do:**

- Click "Import Data" to upload your broker statement CSV files
- Select your broker (currently: Interactive Brokers)
- See all parsed trades, dividends, withholding taxes, and corporate actions in tables
- Edit or delete individual entries if needed
- Manage multiple tax years (each creates a separate "session")

**Practical example:**

- Import your 2025 Interactive Brokers activity statement
- View 47 trades and 8 dividends organized in tables
- Notice a trade with suspicious dates? Delete it and re-import correctly.

---

### 2. Dashboard Page (`/dashboard`)

**Purpose:** See your tax situation at a glance

**What you see:**

- **Metric cards** showing key numbers:
  - Total capital gains
  - Total dividend income
  - Taxes already withheld abroad
  - Total tax you owe
- **Gains vs Taxes** chart: shows your net profit and how much goes to taxes
- **Portfolio Composition** chart: how much is invested in each stock symbol
- **Proceeds vs Cost** chart: for each stock, what you sold it for vs. what you paid

**Practical example:**

- You see you have $15,000 in capital gains and will owe ~$2,850 in Polish taxes
- You received $800 in dividends, withheld $120 in US taxes, and owe ~$32 more to Poland
- Total due: ~$2,882

---

### 3. Tax Form Page (`/tax-form`)

**Purpose:** Auto-calculate your PIT-38 tax form and show exactly what to report

**What you see:**
The form displays **six sections** with calculated numbers:

1. **Section C — Capital Gains/Losses**
   - Proceeds from selling securities
   - Cost basis (what you paid)
   - Net gain or loss
2. **Section D — Tax Calculation**
   - Basis for tax = gain minus any previous losses
   - Tax owed = basis × 19%
   - Can optionally deduct losses from prior years

3. **Sections E & F — Crypto** (currently placeholders, to be implemented)

4. **Section G — Dividend Tax Summary** ([art. 30a](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/))
   - Total dividend income
   - Withholding tax paid abroad (capped per-dividend)
   - Additional tax owed to Poland (~4% after US withholding)

5. **Sections H — Charity Donations** ([art. 45c](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45c/))
   - Optional: 1.5% of tax owed for OPP (Organizacja Pożytku Publicznego)
   - If you donate, it reduces your tax

6. **Summary**
   - Total tax you owe = section D + section G - charity donations

**PIT/ZG attachment:**

When you have income from foreign sources (foreign broker trades or foreign dividends), you must submit a **PIT/ZG** attachment alongside your PIT-38 ([art. 45 ust. 1a ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45/)). PIT/ZG reports:

- Country of income origin (e.g., USA for Interactive Brokers)
- Income amount in PLN
- Tax paid abroad (withholding tax)

You need **one PIT/ZG per country** — if you have dividends from US and German stocks, you file two PIT/ZG attachments. When filing electronically via e-Urząd Skarbowy, PIT/ZG is generated as part of the PIT-38 form. kloPIT shows the values you need to fill in.

**Practical example:**

- Capital gains tax due: $2,850
- Dividend tax due: $32
- You donate $50 to OPP (1.5%)
- **Total tax owed: $2,832**

---

## How The Calculations Work

This section documents the **exact algorithms** implemented in `src/core/tax/`. All calculations are pure TypeScript functions with no side effects.

### Pipeline Overview

The tax calculator (`calculator.ts`) orchestrates five steps:

```
1. calculateCapitalGains()  →  TradeResult[]         (FIFO matching, PLN conversion)
2. calculateDividends()     →  DividendResult[]       (withholding matching, PLN conversion)
3. buildSummary()           →  TaxSummary             (aggregate totals for dashboard)
4. buildPit38()             →  Pit38Fields            (PIT-38 form field values with rounding)
5. buildPitZg()             →  PitZgFields[]          (per-country PIT/ZG attachment)
```

All inputs arrive **pre-enriched** with NBP exchange rates resolved by the service layer before reaching the calculator.

---

### 1. Exchange Rates (NBP)

**Why:** You trade in USD or EUR, but Polish taxes are reported in PLN.

**Legal basis:** [Art. 11a ust. 1 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-11a/) — income in foreign currencies is converted to PLN using the average NBP exchange rate from **the last business day preceding** the date of income. For costs: [art. 22 ust. 1](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-22/) applies the same NBP rate principle.

**How it works:**

- When you import a trade dated January 15, 2025
- The system fetches the NBP (Polish National Bank) exchange rate from **the last business day before** January 15
- Converts your USD amount to PLN using that historical rate
- Stores the rate for your records

**Why the last business day before?** Polish tax law requires it ([art. 11a ust. 1](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-11a/)). Weekends and holidays don't have rates, so we go back to the last trading day.

**Implementation detail:** Each trade/dividend carries two exchange rates resolved before calculation:

- `exchangeRate` — NBP rate for the trade amount (price × quantity)
- `commissionExchangeRate` — NBP rate for the commission amount (may differ if commission currency differs from trade currency)

Both rates are the average NBP Table A rate from the last business day preceding the transaction date.

---

### 2. FIFO Method (First In, First Out)

**Legal basis:** [Art. 24 ust. 10 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/) — when a taxpayer sells securities acquired at different prices and it is not possible to identify specific lots, the FIFO method must be used. This is the default method required by law for pooled brokerage accounts.

**Exact algorithm** (`capital-gains.ts`):

**Step 1 — Seed carry-in positions.** Shares owned from prior years are added to the FIFO queue with `costPerSharePln = 0` and `commissionPerSharePln = 0`. This means their cost basis was already claimed in prior tax years; if these shares are sold, only proceeds generate a taxable event.

**Step 2 — Build unified timeline.** All trades and corporate actions are merged into a single timeline, sorted by datetime. On the same datetime, **corporate actions are processed before trades** (e.g., a stock split on the same day as a sale adjusts quantities first).

**Step 3 — Process events in chronological order.**

FIFO queues are keyed by `ISIN` (preferred) or `symbol` (fallback), uppercased.

**For a BUY trade:**

```
costPerSharePln      = price × exchangeRate
commissionPln        = commission × commissionExchangeRate
commissionPerSharePln = commissionPln / quantity

→ Push lot { quantity, costPerSharePln, commissionPerSharePln } to FIFO queue
```

**For a SELL trade:**

```
proceedsPln     = proceeds × exchangeRate
commissionPln   = commission × commissionExchangeRate
netProceedsPln  = proceedsPln − commissionPln        ← sell commission reduces proceeds

totalCostPln = 0
remainingQty = sell quantity

WHILE remainingQty > 0 AND queue is not empty:
    lot = queue[0]  (oldest lot — FIFO)
    usedQty = min(remainingQty, lot.quantity)
    totalCostPln += usedQty × (lot.costPerSharePln + lot.commissionPerSharePln)
    remainingQty -= usedQty
    IF usedQty >= lot.quantity → remove lot from queue
    ELSE → reduce lot.quantity by usedQty

gainLossPln = netProceedsPln − totalCostPln
```

If the queue is empty before all shares are consumed, the calculator throws an error (insufficient buy lots).

**Only sells within the tax period** are recorded as results. Buys and sells outside the period still affect the FIFO queue state (they are "processed through" to maintain correct lot ordering).

**Example:**

- Buy 100 AAPL on Jan 1 at $150 (NBP rate 4.0) → costPerSharePln = 600 PLN
- Buy 50 AAPL on Jan 15 at $160 (NBP rate 4.1) → costPerSharePln = 656 PLN
- Sell 120 AAPL on Jan 20 at $170 (NBP rate 4.05), commission $10

```
proceedsPln    = 120 × 170 × 4.05 = 82,620 PLN
commissionPln  = 10 × 4.05 = 40.50 PLN
netProceedsPln = 82,620 − 40.50 = 82,579.50 PLN

FIFO lot 1: 100 shares × 600 PLN = 60,000 PLN (+ buy commission)
FIFO lot 2:  20 shares × 656 PLN = 13,120 PLN (+ buy commission)
totalCostPln = 73,120 PLN + buy commissions

gainLossPln = 82,579.50 − totalCostPln
```

---

### 3. Corporate Actions

**Implementation:** `corporate-actions.ts`

Corporate actions modify FIFO lots before subsequent trades are processed.

#### Stock Splits

**Legal basis:** Stock splits are not taxable events — they only change the number of shares and cost per share, preserving total cost basis.

```
factor = numerator / denominator

For each lot:
    lot.quantity          *= factor
    lot.costPerSharePln   /= factor
    lot.commissionPerSharePln /= factor
```

**Example:** 4-for-1 split (numerator=4, denominator=1, factor=4):

- 100 shares at 600 PLN/share → 400 shares at 150 PLN/share
- Total cost basis unchanged: 60,000 PLN

Supports both forward splits (factor > 1) and reverse splits (factor < 1).

#### Mergers (Cash-and-Stock)

**Legal basis:** [Art. 24 ust. 8 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/) — cost basis allocation in corporate reorganizations.

```
totalOldQty  = sum of all lot quantities
totalCostPln = sum of (quantity × (costPerSharePln + commissionPerSharePln)) for all lots
cashProceeds = totalOldQty × cashPerShare
totalNewQty  = totalOldQty × conversionRatio

// Proportional cost allocation based on Fair Market Value
IF cashProceeds == 0:
    cashFraction = 0
ELSE IF newSharesValue is provided and > 0:
    cashFraction = cashProceeds / (cashProceeds + newSharesValue)
ELSE:
    cashFraction = 1  // conservative: all cost to cash

allocatedCashCostPln = totalCostPln × cashFraction
remainingCostPln     = totalCostPln − allocatedCashCostPln
```

The cash portion is a **taxable event** (synthetic sell recorded in results if within the tax period). The stock portion creates a **new FIFO lot** under the target symbol with the remaining cost basis. Old symbol lots are removed from the queue.

---

### 4. Capital Gains Tax (19%)

**Legal basis:** [Art. 30b ust. 1 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30b/) — income from the sale of securities is taxed at a flat rate of 19%.

**Summary-level formula** (`buildSummary` in `calculator.ts`):

```
totalProceedsPln   = sum of proceedsPln for all sells
totalCostPln       = sum of costPln for all sells
capitalGainPln     = totalProceedsPln − totalCostPln
capitalGainTaxPln  = max(capitalGainPln, 0) × 0.19
```

Note: `capitalGainTaxPln` in the summary is the **pre-rounding, pre-deduction** value used for dashboard display. The PIT-38 form applies additional rounding and prior-year loss deductions (see Section 7 below).

**What counts as cost (koszty uzyskania przychodu):**

- **Buy price in PLN:** `price × NBP_rate_from_day_before_buy`
- **Buy commission in PLN:** `commission × NBP_rate_from_day_before_buy`
- Both are stored per-share in the FIFO lot and consumed proportionally on sell

**What counts as proceeds (przychody):**

- **Sell price in PLN:** `proceeds × NBP_rate_from_day_before_sell`
- **Minus sell commission in PLN:** `commission × NBP_rate_from_day_before_sell`

**Rounding:** Tax base and tax owed are rounded to full złoty using mathematical rounding ([art. 63 § 1 Ordynacji podatkowej](https://lexlege.pl/ordynacja-podatkowa/art-63/) — amounts ending in less than 50 groszy are discarded, 50 groszy and above are rounded up to the next full złoty).

---

### 5. Dividend Tax (19%)

**Legal basis:** [Art. 30a ust. 1 pkt 4 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) — foreign dividends are taxed at a flat rate of 19% (zryczałtowany podatek dochodowy).

**Exact algorithm** (`dividends.ts`):

**Step 1 — Match dividends with withholding taxes.**

Withholding taxes are grouped by a composite key: `YYYY-MM-DD:ISIN` (or `YYYY-MM-DD:SYMBOL` if ISIN is unavailable). Each dividend is matched to its withholding tax entries using the same key.

**Step 2 — Convert each dividend to PLN.**

```
For each dividend in the tax period:
    amountPln          = dividend.amount × dividend.exchangeRate
    withholdingTaxPln  = sum of (|tax.amount| × tax.exchangeRate) for matched taxes
```

Note: Interactive Brokers stores withholding amounts as negative numbers — `Math.abs()` is applied.

Each withholding tax entry may have its own exchange rate (the NBP rate from the last business day before the withholding date).

**Step 3 — Per-dividend withholding cap** (applied in `buildSummary`):

**Important: [Art. 30a ust. 9](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/)**

```
For each dividend:
    deductibleWithholding = min(withholdingTaxPln, amountPln × 0.19)

totalDeductibleWithholdingPln = sum of deductibleWithholding for all dividends
dividendTaxOwedPln = max(totalDividendsPln × 0.19 − totalDeductibleWithholdingPln, 0)
```

The per-dividend cap ensures that excess foreign tax on one dividend **cannot** offset tax owed on another dividend.

**Mathematical equivalence note:** Since `min(w, d×0.19) ≤ d×0.19` for every dividend, the per-dividend owed amount is always ≥ 0, making the aggregate formula equivalent to summing per-dividend results.

**Example with mixed withholding rates:**

- Dividend A: 100 PLN gross, 30% foreign tax = 30 PLN withheld
  - Deductible: min(30, 19) = **19 PLN** (11 PLN excess is lost)
  - To pay: 19 − 19 = **0 PLN**
- Dividend B: 100 PLN gross, 0% foreign tax = 0 PLN withheld
  - Deductible: min(0, 19) = **0 PLN**
  - To pay: 19 − 0 = **19 PLN**
- **Total to pay: 19 PLN** (not 8 PLN, which would result from pooling)

---

### 6. Rounding Rules

**Implementation:** `rounding.ts`

Two distinct rounding functions are used, matching separate legal provisions:

| Function         | Legal basis                                                                         | Algorithm                                                  | Used for                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `roundToFullPln` | [Art. 63 § 1 Ordynacji podatkowej](https://lexlege.pl/ordynacja-podatkowa/art-63/)  | `Math.round(amount)` — mathematical rounding to full złoty | Tax base (poz. 31), tax due (poz. 35), total tax to pay (poz. 51), overpayment (poz. 52) |
| `roundToGroszUp` | [Art. 63 § 1a Ordynacji podatkowej](https://lexlege.pl/ordynacja-podatkowa/art-63/) | `Math.ceil(amount × 100) / 100` — ceiling to full groszy   | Dividend tax 19% amount (poz. 47), dividend tax difference (poz. 49)                     |

**`roundToGroszUp` precision handling:** Uses `+(amount * 100).toFixed(10)` before `Math.ceil` to avoid floating-point artifacts (e.g., `0.1 + 0.2 = 0.30000000000000004`).

---

### 7. PIT-38 Form Mapping (PIT-38(18))

**Implementation:** `pit38.ts`

The `buildPit38()` function maps aggregated tax data to the official PIT-38(18) form fields. Here is the exact computation for each populated field:

#### Section C — Capital Gains/Losses ([art. 30b ust. 1](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30b/))

```
poz20 = 0                                    // PIT-8C proceeds (N/A for foreign broker)
poz21 = 0                                    // PIT-8C costs
poz22 = totalProceedsPln                     // Other proceeds (foreign broker)
poz24 = 0                                    // Exempt proceeds (art. 21 ust. 1 pkt 105a)
poz25 = 0                                    // Exempt costs
poz26 = poz20 + poz22 − poz24               // Total proceeds
poz27 = poz21 + totalCostPln − poz25        // Total costs
poz28 = max(poz26 − poz27, 0)              // Gain (dochód)
poz29 = max(poz27 − poz26, 0)              // Loss (strata)
```

#### Section D — Tax Calculation

```
poz30 = min(priorYearLoss, poz28)            // Prior year loss deduction (capped at gain)
poz31 = roundToFullPln(max(poz28 − poz30, 0))  // Tax base (podstawa obliczenia podatku)
poz33 = poz31 × 0.19                        // Tax amount (podatek)
poz34 = 0                                    // Foreign tax on capital gains (not applicable)
poz35 = roundToFullPln(max(poz33 − poz34, 0))  // Tax due (podatek należny)
```

#### Sections E & F — Crypto (placeholders, all zeros)

Not yet implemented. Fields poz36–poz45 are set to 0.

#### Section G — Payment Summary

```
poz46 = 0                                                        // Other flat-rate tax (not applicable)
poz47 = roundToGroszUp(totalDividendsPln × 0.19)                 // Foreign dividend tax (19%)
poz48 = round_to_groszy(min(totalDeductibleWithholdingPln, poz47))  // Deductible foreign tax
poz49 = roundToGroszUp(max(poz47 − poz48, 0))                   // Dividend tax difference (art. 63 § 1a)
poz50 = 0                                                        // Advance payments by payers
poz51 = roundToFullPln(max(poz35 + poz45 + poz46 + poz49 − poz50, 0))  // TAX TO PAY (art. 63 § 1)
poz52 = roundToFullPln(max(poz50 − (poz35 + poz45 + poz46 + poz49), 0))  // OVERPAYMENT (art. 63 § 1)
```

Where `round_to_groszy` uses `Math.round(amount × 100) / 100` (standard rounding to nearest grosz).

#### Sections H & I — Monthly Flat-Rate Tax (placeholders, all zeros)

Not yet implemented. Fields poz53–poz65 are set to 0.

---

### 8. PIT/ZG Attachment (Per-Country)

**Implementation:** `pit-zg.ts`

**Legal basis:** [Art. 45 ust. 1a ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45/) — PIT/ZG is required for foreign income. One attachment per country of income.

**Country determination:** Extracted from the ISIN prefix (first 2 characters, ISO 3166-1 alpha-2). Falls back to `'XX'` if ISIN is unavailable.

**Algorithm:**

```
For each country:
    // From sell trades:
    proceedsPln = sum of trade.proceedsPln for sells in this country
    costPln     = sum of trade.costPln for sells in this country
    gainPln     = max(proceedsPln − costPln, 0)
    lossPln     = max(costPln − proceedsPln, 0)

    // From dividends:
    dividendIncomePln       = sum of div.amountPln for dividends in this country
    foreignTaxPaidPln       = sum of div.withholdingTaxPln
    deductibleForeignTaxPln = sum of min(div.withholdingTaxPln, div.amountPln × 0.19)
                              // Per-dividend cap per art. 30a ust. 9
```

Results are sorted alphabetically by country code.

---

### 9. Prior Year Losses (Carry-Over)

**Legal basis:** [Art. 9 ust. 3 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-9/) — losses from a given income source can be carried forward for up to 5 consecutive tax years, with two alternative methods:

**Option 1 (gradual):** Deduct up to **50% of the loss per year** across 5 years ([art. 9 ust. 3 pkt 1](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-9/)).

**Option 2 (one-time):** Deduct the entire loss in a single year, up to **5,000,000 PLN** ([art. 9 ust. 3 pkt 2](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-9/)). Any remainder above 5M PLN follows the 50% rule for subsequent years.

**Implementation detail:** The user manually enters the deduction amount (`priorYearLoss`). The code caps it at the current year's gain:

```
deductible = min(priorYearLoss, capitalGain)
```

The 50% limit and 5-year carry-forward tracking are **not enforced by the calculator** — the user is responsible for computing the correct deduction amount. This is by design for flexibility (supports both option 1 and option 2).

---

## Data Import: Interactive Brokers

### What the app can read from your CSV

When you download your Activity Statement from Interactive Brokers and import it, the app extracts:

1. **Trades**
   - Symbol (e.g., "AAPL")
   - Date and time
   - Buy or sell
   - Quantity and price
   - Commissions

2. **Dividends**
   - Symbol
   - Date
   - Dividend amount (gross)
   - Currency

3. **Withholding Taxes**
   - How much tax was withheld on dividends
   - Usually 15% for US dividends

4. **Corporate Actions**
   - Stock splits (e.g., 4-for-1)
   - Allows correct quantity tracking after splits

5. **Carry-In Positions**
   - Shares you owned before importing (from prior years)
   - Needed for accurate FIFO calculations

---

## How Your Data is Stored

### IndexedDB: Browser Database

**What it is:** A database that lives on your computer, inside your browser.

**Why not just files?**

- Files don't persist after you close the browser
- IndexedDB is specifically designed for web apps that need local databases
- It can store gigabytes (more than enough for years of trading data)
- It's faster than files and doesn't require re-parsing everything

### Session Structure

A **session** = one tax year = one calculation workspace

Each session contains:

- **Trades table:** All buy and sell transactions
- **Dividends table:** All dividend income
- **Withholding table:** Tax withheld abroad
- **Corporate actions table:** Stock splits and similar events
- **Carry-in positions table:** Prior year shares
- **Results table:** Calculated gains, losses, tax amounts
- **Tax summary:** Final PIT-38 form fields ready for reporting

**Example:**

- Session A: Tax year 2024 (47 trades, 8 dividends)
- Session B: Tax year 2025 (12 trades so far, 2 dividends)

You can have multiple sessions active simultaneously and compare them.

---

## Supported Brokers

Currently: **Interactive Brokers**

The app is designed to accept more brokers in the future by registering new parser modules without changing existing code.

To support a new broker:

1. Register the CSV format with the parser registry
2. Write a parser that extracts fields from that CSV
3. Map those fields to the standard data model (trades, dividends, etc.)

---

## Localization (Multiple Languages)

The app supports **three languages:**

- **English (EN)** — primary, fully translated
- **Polish (PL)** — in progress
- **Ukrainian (UK)** — in progress

**How it works:**

- All text is stored in `messages/en.json`, `messages/pl.json`, `messages/uk.json`
- The URL changes the language: `/` is English, `/pl/` is Polish, `/uk/` is Ukrainian
- All pages and forms are translated

---

## What Happens When You Calculate Taxes

**Trigger:** Click "Calculate Taxes" on the Tax Form page.

**Process:**

1. **Load data** — Fetch all trades, dividends, withholding taxes, corporate actions, and carry-in positions from your session in IndexedDB
2. **Resolve exchange rates** — For each transaction, fetch the NBP Table A average rate from the last business day before the transaction date. Each trade gets two rates (amount + commission). Each dividend and withholding tax entry gets its own rate.
3. **Capital gains** (`calculateCapitalGains`):
   - Seed carry-in positions into FIFO queues (cost = 0, already claimed)
   - Build unified timeline of trades + corporate actions, sorted chronologically
   - Process each event: buys push lots, corporate actions modify lots, sells consume lots via FIFO
   - Record sell results with PLN amounts for trades within the tax period
4. **Dividends** (`calculateDividends`):
   - Match each dividend with its withholding tax entries by (date, ISIN/symbol) key
   - Convert amounts and withholding to PLN using their respective exchange rates
5. **Summary** (`buildSummary`):
   - Aggregate proceeds, costs, and capital gain from all sell trades
   - Aggregate dividend amounts and apply per-dividend withholding cap ([art. 30a ust. 9](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/))
   - Compute raw (unrounded) tax amounts for dashboard display
6. **PIT-38** (`buildPit38`):
   - Map summary values to form fields with proper rounding
   - Apply prior-year loss deduction (capped at gain amount)
   - Round tax base and tax due to full PLN ([art. 63 § 1](https://lexlege.pl/ordynacja-podatkowa/art-63/))
   - Round dividend tax to full groszy up ([art. 63 § 1a](https://lexlege.pl/ordynacja-podatkowa/art-63/))
7. **PIT/ZG** (`buildPitZg`):
   - Group trades and dividends by country (from ISIN prefix)
   - Compute per-country proceeds, costs, gain/loss, dividend income, and foreign tax
8. **Store & display** — Save all results to IndexedDB, update dashboard charts and form fields

**Time:** Usually < 1 second (depends on number of trades, mostly waiting for NBP rate API responses during the enrichment step).

---

## Privacy & Security

### What stays on your computer

- All broker statements
- All parsed trades and dividends
- All calculated tax results
- All exchange rates

### What's never saved

- Your password or login credentials (never entered)
- Any personally identifiable information beyond what you import

### How deletion works

- Delete a session = clears entire database for that year
- Clear browser cache/cookies = entire local database is lost
- Recommend: export or screenshot your tax form before clearing

---

## Limitations & Future Features

### Current scope

- ✅ Stock trades (capital gains)
- ✅ Dividends (with foreign withholding)
- ✅ Corporate actions (stock splits)
- ✅ Multi-currency support (USD, EUR)
- ✅ PIT-38 form fields sections C, D, G
- ⏳ Cryptocurrency (framework in place, not yet implemented)
- ⏳ Other brokers (planned)

### Known limitations

- No automatic backup — data is local only. Export results before clearing browser storage.
- No password-protected sessions — anyone with access to your computer can see data
- PIT-38(18) form fields only — changes annually

---

## Example: Complete Year End Tax Filing

**Scenario:** You're ready to file your 2025 Polish taxes before the April 30, 2026 deadline ([art. 45 ust. 1 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45/)).

**Step 1: Collect statements**

- Download 2025 Activity Statement from Interactive Brokers

**Step 2: Import in kloPIT**

- Open `/data` page
- Click "Import Data"
- Select broker: Interactive Brokers
- Upload your CSV
- Review: are all 42 trades and 6 dividends showing?

**Step 3: Check raw data**

- See any errors in trades or dividends?
- Edit or delete rows as needed
- (e.g., a test trade that should be deleted)

**Step 4: Calculate taxes**

- Go to `/tax-form`
- Click "Calculate Taxes"
- System fetches all NBP rates, applies FIFO, computes everything

**Step 5: Review results**

- Dashboard shows: $18,500 gains, $2,800 tax owed, $150 dividend tax owed
- Form shows exact PIT-38 field values to copy into your official filing

**Step 6: File with tax authority**

- Copy values from `/tax-form` into official PIT-38 on podatki.gov.pl
- Fill in PIT/ZG attachment (one per country of income — e.g., USA)
- Submit and pay before April 30

---

## FAQ

**Q: Can I edit a trade after importing?**  
A: Yes, on the Data page. Find the trade in the table, click Edit, modify, and save.

**Q: What if I upload the same file twice?**  
A: Duplicates will appear. You can delete the old ones manually.

**Q: Can I export my results?**  
A: Currently: take a screenshot or copy-paste values. Full export planned.

**Q: What if NBP rates are unavailable?**  
A: The app stores a note and uses the last available rate. Tax is still calculated, but flagged for review.

**Q: Can I calculate taxes for multiple years at once?**  
A: Yes — create separate sessions for each year. Each calculates independently.

**Q: Is this an official tax form?**  
A: No. The app helps you calculate amounts and organize data. You still submit an official PIT-38 form to the tax authority.

**Q: What about CGT from selling at a loss?**  
A: Losses are tracked and can offset gains up to limits, or be carried forward 5 years at 50% per year.

---

## Legal References

Key Polish tax law provisions used in kloPIT calculations:

| Topic                            | Legal basis                        | Link                                                                                     |
| -------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| PIT-38 form obligation           | Art. 45 ust. 1a pkt 1 ustawy o PIT | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45/)  |
| Capital gains tax 19%            | Art. 30b ust. 1 ustawy o PIT       | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30b/) |
| Dividend tax 19%                 | Art. 30a ust. 1 pkt 4 ustawy o PIT | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) |
| Foreign tax deduction cap        | Art. 30a ust. 9 ustawy o PIT       | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) |
| FIFO method                      | Art. 24 ust. 10 ustawy o PIT       | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/)  |
| Exchange rate conversion         | Art. 11a ust. 1 ustawy o PIT       | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-11a/) |
| Loss carry-forward (5 years)     | Art. 9 ust. 3 ustawy o PIT         | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-9/)   |
| Rounding to full PLN             | Art. 63 § 1 Ordynacji podatkowej   | [lexlege.pl](https://lexlege.pl/ordynacja-podatkowa/art-63/)                             |
| Rounding to full groszy          | Art. 63 § 1a Ordynacji podatkowej  | [lexlege.pl](https://lexlege.pl/ordynacja-podatkowa/art-63/)                             |
| OPP 1.5% donation                | Art. 45c ustawy o PIT              | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45c/) |
| Filing deadline (April 30)       | Art. 45 ust. 1 ustawy o PIT        | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45/)  |
| PIT/ZG attachment                | Art. 45 ust. 1a ustawy o PIT       | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45/)  |
| US-Poland tax treaty (dividends) | Art. 11 Konwencji PL-US            | [isap.sejm.gov.pl](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19760310178)   |

**Full legal texts:**

- [Ustawa o podatku dochodowym od osób fizycznych (PIT)](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/) — Dz.U. 1991 nr 80 poz. 350
- [Ordynacja podatkowa](https://lexlege.pl/ordynacja-podatkowa/) — Dz.U. 1997 nr 137 poz. 926

---

## Glossary

| Term                 | Meaning                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| **FIFO**             | First In, First Out — method to match sales with purchases                     |
| **NBP**              | Narodowy Bank Polski (Polish National Bank) — provides official exchange rates |
| **PIT-38**           | Polish tax form for capital gains and dividends                                |
| **PIT/ZG**           | Required attachment to PIT-38 for foreign income — one per country             |
| **OPP**              | Charity donation (1.5% of tax owed, optional)                                  |
| **Withholding Tax**  | Tax deducted by foreign broker (usually 15% US dividends)                      |
| **Carry-In**         | Shares owned from prior tax years                                              |
| **Corporate Action** | Stock split, dividend spin-off, etc.                                           |
| **Session**          | One tax year's workspace (trades + dividends + results)                        |
| **IndexedDB**        | Browser database where your data is stored locally                             |
