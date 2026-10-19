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
(trades, dividends)        categories + warnings     apply FIFO method,        tax form,
                           Store in database         compute taxes             export results
```

### Example: You sell 100 Apple shares

1. **Import phase:** The system reads your Interactive Brokers CSV, classifies every section, imports supported rows, and flags rows it skipped
2. **Organize phase:** Parsed data is stored with metadata (dates, amounts, currencies), while import warning summaries are attached to the tax-year session
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
- Review an amber warning banner if some CSV rows were skipped
- Open the **Skipped** tab to inspect skipped rows during the current import session
- Edit or delete individual entries if needed
- Manage multiple tax years (each creates a separate "session")

**Practical example:**

- Import your 2025 Interactive Brokers activity statement
- View 47 trades and 8 dividends organized in tables
- See that `Options` rows were skipped because that section is not supported yet
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
The form displays PIT-38 sections in the same order as the official form:

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

5. **Section H — Monthly Flat-Rate Tax** (placeholder)
   - Monthly fields are shown as unsupported zero placeholders

6. **Section J — OPP 1.5% Request** ([art. 45c](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45c/))
   - Optional KRS, requested amount, purpose, and consent fields
   - The requested amount is displayed as 1.5% of supported PIT-38 tax due from poz. 35, rounded down to full 10 groszy
   - This is a request to redirect part of tax already due; it does not reduce the PIT-38 tax-to-pay value

**PIT/ZG attachment:**

kloPIT generates PIT/ZG for **share income reported in PIT/ZG section C.3** alongside PIT-38 ([art. 45 ust. 1a ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45/)). PIT/ZG reports:

- Country of income origin: item 6 country name and item 7 country code
- Income from abroad: item 29
- Tax paid abroad on that income: item 30

PIT/ZG is **required only for countries where foreign tax on the gain is credited** (art. 30b ust. 5a/5b updof; MF "Broszura do PIT-38 za 2025 r.", Część L). Share gains are normally taxable only in Poland under the treaties (OECD MC art. 13 ust. 5), but kloPIT does not assert that: it only knows that no foreign tax on gains is recorded. Such countries are shown muted as "Not required — no foreign tax on capital gains recorded for this country (informational)" and are not counted as attachments. The country is inferred from ISIN country mappings, and dividend ISINs are reused to fill the country for the same symbol when trade rows do not have a usable ISIN country.

**Capital gains always use the ISIN-prefix country.** An ADR such as TSM (`US8740391003`) is US in `TradeResult.country` and in PIT/ZG, even when its dividends come from another state. Only dividends use a different country for ADRs (see step 1 in "Dividend Tax"). A user country override can be scoped to dividends, gains or both (a missing scope means both). When filing electronically via e-Urząd Skarbowy, PIT/ZG is generated as part of the PIT-38 form. kloPIT shows the values you need to fill in.

Foreign dividends are settled in PIT-38 section G by default, not PIT/ZG. A disabled-by-default compatibility setting named **Show dividends in PIT/ZG** can add helper dividend rows to the PIT/ZG view when a user intentionally wants that extra view.

**Practical example:**

- Capital gains tax due: $2,850
- Dividend tax due: $32
- You request a 1.5% OPP transfer from the Section J helper
- **Total tax owed: $2,882** (the OPP request does not reduce the tax due)

---

## How The Calculations Work

This section documents the **exact algorithms** implemented in `src/core/tax/`. All calculations are pure TypeScript functions with no side effects.

### Pipeline Overview

The tax calculator (`calculator.ts`) orchestrates six steps:

```
1. calculateCapitalGains()  →  TradeResult[]         (FIFO matching, PLN conversion)
2. calculateDividends()     →  DividendResult[]       (withholding matching, PLN conversion)
3. calculateCreditInterest()→  CreditInterestResult[] (PLN conversion, 19% flat rate)
4. buildSummary()           →  TaxSummary             (aggregate totals for dashboard)
5. buildPit38()             →  Pit38Fields            (PIT-38 form field values with rounding)
6. buildPitZg()             →  PitZgFields[]          (per-country PIT/ZG C.3 share income, `required` only with foreign tax; optional dividend compatibility rows)
```

All inputs arrive **pre-enriched** with NBP exchange rates resolved by the service layer before reaching the calculator.

---

### 1. Exchange Rates (NBP)

**Why:** You trade in USD or EUR, but Polish taxes are reported in PLN.

**Legal basis:** [Art. 11a ust. 1 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-11a/) — income in foreign currencies is converted to PLN using the average NBP exchange rate from **the last business day preceding** the date of income. For costs: [art. 11a ust. 2](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-11a/) applies the same NBP rate principle (the last business day before the cost was incurred).

**How it works:**

- When you import a trade dated January 15, 2025
- The system fetches the NBP (Polish National Bank) exchange rate from **the last business day before** January 15
- Converts your USD amount to PLN using that historical rate
- Stores the rate for your records
- If the session setting **Use estimated T+2 settlement dates for trade rates** is enabled, trade proceeds, costs, and commissions instead use the last Polish business day before the estimated T+2 settlement date. Dividends, withholding tax, credit interest, and corporate-action cash keep using their own event dates.

**Why the last business day before?** Polish tax law requires it ([art. 11a ust. 1](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-11a/)). Weekends and holidays don't have rates, so we go back to the last trading day.

**Implementation detail:** Each trade/dividend carries two exchange rates resolved before calculation:

- `exchangeRate` — NBP rate for the trade amount (price × quantity)
- `commissionExchangeRate` — NBP rate for the commission amount (may differ if commission currency differs from trade currency)

By default both rates are the average NBP Table A rate from the last business day preceding the transaction date. With the settlement-date setting enabled, trade rates use the last Polish business day preceding the estimated T+2 settlement date.

**Fetching and caching:** Rates are fetched from the NBP API (at most 93 days per request) and cached in IndexedDB. NBP publishes table A on business days around 12:15 Warsaw time and rejects requests for dates after today, so requests are always clamped to today (Europe/Warsaw). Days without a table are cached as holidays only once they are in the past; today's missing table is never cached. If the required rate is not published yet (an event dated today, or an estimated T+2 settlement date in the future), it is reported as missing rather than replaced by an older rate. Recalculate after publication to pick up the correct rate.

**Missing rates:** If an NBP rate cannot be resolved (not yet published, or the fetch failed, e.g. while offline), the amount is converted at rate 0 and the row is flagged `rateUnavailable`. A missing rate on a **buy** is carried on its FIFO lot (through stock splits and mergers), so every sell that consumes that lot is also flagged (`rateUnavailable` + `costRateUnavailable`), even when the buy happened in an earlier year. `TaxSummary.missingRateCount` counts all flagged trade, dividend and credit-interest rows; when it is above 0 the dashboard shows a warning, and the Tax Form page shows a red banner, marks the form as a draft that must not be filed and disables copying PIT-38 values.

---

### 2. FIFO Method (First In, First Out)

**Legal basis:** [Art. 24 ust. 10 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/) — when a taxpayer sells securities acquired at different prices and it is not possible to identify specific lots, the FIFO method must be used. This is the default method required by law for pooled brokerage accounts.

**Exact algorithm** (`capital-gains.ts`):

**Step 1 — Prepare carry-in positions.** Shares owned before the imported history starts (carry-ins) still carry their acquisition cost. Under [art. 23 ust. 1 pkt 38](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-23/) with [art. 30b ust. 2 pkt 1 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30b/) that cost is deductible in the year the shares are **sold**, not in the year they were bought, so nothing was "already claimed". Each carry-in gets a PLN cost before the FIFO run:

- `costBasisPln` entered by the user is used as is.
- `costBasis` in a foreign currency is converted at the NBP rate from the last business day before the acquisition date ([art. 11a ust. 2](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-11a/)), so a foreign-currency cost requires an acquisition date. A cost without a currency is treated as PLN.
- A cost explicitly confirmed as zero is 0. This is only for shares from a qualifying incentive program not taxed when received ([art. 24 ust. 11](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/)); RSU or ESPP shares taxed at vesting or purchase have that taxed value as their cost.
- Otherwise the cost is **missing**: it counts as 0 PLN, but every sale that consumes the lot is flagged (`costBasisMissing`) on the dashboard and in the transactions table, and the tax form is marked as incomplete (copying disabled) until the cost is entered.

A carry-in must belong to a year before the tax year, and its acquisition date (if any) must fall on or before December 31 of that year.

Carry-ins are keyed by ISIN when known (the parser back-fills it from the statement's instrument list), falling back to the ISIN of a trade or corporate action with the same symbol, then to the symbol, so they match the trades that sell them. A corporate action's ISIN is not used for a symbol whose trades have no ISIN, since those trades are keyed by symbol.

**Step 2 — Build unified timeline.** All trades, corporate actions and carry-in positions are merged into a single timeline, sorted by datetime. A carry-in is placed at its acquisition date, so FIFO consumes lots in true acquisition order ([art. 24 ust. 10](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/)). An undated carry-in is placed just before the first imported trade of the instrument after the previous snapshot (and never after the end of its year), because shares the imported history cannot explain are assumed to be older than it. On the same datetime, **corporate actions are processed first, then carry-ins, then trades** (e.g., a stock split on the same day as a sale adjusts quantities first).

Carry-ins are treated as per-instrument **snapshots**: "held N shares at the end of year Y". Years are processed in ascending order. The holding implied by the imported events (and earlier snapshots) at December 31 of Y is compared with the snapshot. The shares it does not explain were held before every imported trade since the previous snapshot, so they are modelled as one lot placed at the earliest carry-in row, priced like the oldest row. FIFO sells that lot before any later imported buy: the part that imported sells consume (shares sold before the snapshot) is seeded as a separate lot at that placement, and the part that survives to December 31 is the share of the snapshot the imported buys do not explain. The rest of the snapshot is explained by imported buys:

- If imported buys explain the whole snapshot, no carry-in row is seeded and a warning is shown (a later-year snapshot of the same shares, or a position fully explained by imported buys, is not double counted). Such rows need no acquisition cost and are not listed as missing one.
- If they explain part of it, only the rest is seeded. The latest-acquired rows are reduced first, a warning is shown, and the cost of a partly seeded row is pro-rated per share (with a separate warning).
- If the snapshot is below the implied holding, or imported sells would exceed the holding even with the unexplained shares, the imports and the snapshot disagree (missing or duplicate imports): the snapshot is skipped, a warning is shown, and the tax form is marked incomplete (copying disabled), because the calculation may still hold shares the broker no longer reports. If an imported sell then has no shares left to consume (e.g. a sell before the buys that the snapshot should have covered), the calculation stops with a short-sell error instead.

A merger target without an ISIN is matched through the same symbol → ISIN lookup, so its lots join the target's trades.

Splits dated after a carry-in's acquisition and up to December 31 of its year are assumed to be already reflected in its quantity and are not applied again (the lot of shares sold before the snapshot is converted back to the units of its placement the same way); later splits are applied by the timeline as usual.

**Step 3 — Process events in chronological order.**

FIFO queues are keyed by **account** and then by `ISIN` (preferred) or `symbol` (fallback), uppercased (plus the lot id for IBI lots sold by specific identification). See [FIFO per securities account](#fifo-per-securities-account) below.

**For a BUY trade:**

```
costPerSharePln      = price × exchangeRate
commissionPln        = commission × commissionExchangeRate
commissionPerSharePln = commissionPln / quantity

→ Push lot { quantity, costPerSharePln, commissionPerSharePln } to FIFO queue
```

**For a SELL trade:**

```
proceedsPln         = proceeds × exchangeRate              ← gross (PIT-38 poz. 22)
sellCommissionPln   = commission × commissionExchangeRate

totalCostPln = 0
remainingQty = sell quantity

WHILE remainingQty > 0 AND queue is not empty:
    lot = queue[0]  (oldest lot — FIFO)
    usedQty = min(remainingQty, lot.quantity)
    totalCostPln += usedQty × (lot.costPerSharePln + lot.commissionPerSharePln)
    remainingQty -= usedQty
    IF usedQty >= lot.quantity → remove lot from queue
    ELSE → reduce lot.quantity by usedQty

totalCostPln += sellCommissionPln                    ← sell commission is a cost (poz. 23)

gainLossPln = proceedsPln − totalCostPln
```

If the queue is empty before all shares are consumed, the calculator does not stop: the missing shares get cost 0, the sell is flagged `costBasisMissing` (it counts in `missingCostCount`, so the form is a draft) and a warning explains the likely cause (see below).

#### FIFO per securities account

[Art. 24 ust. 10 updof](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/) applies FIFO "odrębnie dla każdego rachunku papierów wartościowych" — separately for each securities account. Every trade, carry-in and corporate action therefore carries an `account` (`<broker>:<id>`, e.g. `ibkr:U123`, `schwab:default`, `manual:<label>`) and the queue key is `account|ISIN-or-symbol`. A sell at one account never consumes lots of another, even when those are older. Inside an account a specific lot may still be identified (IBI `lotId`), as confirmed by the tax authority ruling KIS 0112-KDWL.4011.2.2025.1.TW.

- **Rows without an account (legacy).** If the session's rows have at most one distinct account, unstamped rows join it and the results are the same as before accounts existed. With several accounts, attributing an unstamped row to an account is always a guess, so it is never silent. Per instrument, dry runs over its connected component (the instrument plus everything tied to it by mergers or symbol/ISIN changes) compare the rows kept apart (the `unassigned` account) with the rows joined to each account that holds anything in its component (so an account with only the merger target's rows counts) (matched by ISIN or symbol, also across brokers that key differently). An account takes the rows only when joining lowers the instrument's total shortfall and adds none to that account; exactly one such account gives an informational `account-assumed` warning. With no shortfall, the rows stay apart and the result stays final only if joining any holder would leave the in-period sells unchanged. Every other case (several resolving accounts, none, or a choice that changes the result) stays `unassigned` and the `account-unassigned` warning makes the form a draft. Unassigned rows are never offered as transfer donors or receivers; assign an account on the Data page (the carry-in editor has the Account field too).
- **Corporate actions.** An action with an account changes that account's queues only. An action without one (legacy, or manual "all accounts") applies to every account holding the instrument. The same split reported twice (e.g. by two brokers, or a manual entry next to a timestamped import) is applied once per account: two splits are the same when they fall on the same local calendar day with the same ratio.
- **Carry-in snapshots** and their netting against imported trades run per (account, instrument), and the symbol → ISIN lookup is per account: a manual Schwab carry-in without an ISIN does not net against an IBKR ISIN queue.
- **Transfers.** A manual `transfer` corporate action ("Add transfer" on the Data page, Corporate actions tab; also offered by the `transfer-suggested` warning, prefilled) moves `quantity` shares from `fromAccount` to `toAccount` at its date. It is not a disposal (no proceeds, no income): the oldest lots of the source account move first (its IBI lot-id queues are merged by acquisition date), keep their PLN cost, flags (`costMissing`, rate unavailable) and incentive cost, and are inserted into the destination queue ordered by their original `acquiredAt`. The IBI `lotId` ends at the destination. On the same moment, splits and mergers apply before the transfer; a split or merger after it acts on the destination's queue. A source that holds too few shares moves what exists, never invents cost, raises `transfer-shortfall` and drafts the destination's later sells (like any shortfall). A transfer ties both accounts to the instrument for the unstamped-row joins, and its row is part of every dry run of its component, so a join that only lets the transfer be covered is found. IBKR "Transfers" rows are not imported (the counterpart is not reliably known); they stay a warning pointing to "Add transfer".
- **Transfers and carry-in snapshots.** A snapshot is the holding at the end of its year, so a transfer out of the same account between the previous snapshot and that year-end is already reflected in it. The reconciliation keeps such transfers (they draw from imported or earlier lots, so imports that already explain the year-end stay consistent), but the shares the snapshot adds are shielded: no transfer up to that year-end can draw from them. If nothing else can supply the moved shares, the transfer reports a `transfer-shortfall` (their cost is unknown) and the destination's later sells are drafts, even when the destination has a snapshot of its own. The source keeps the snapshot's shares, and a snapshot without cost is still asked for. A short transfer's explained part never makes its source a suggested donor for the destination's sells; other accounts holding the instrument still taint (the shares may have come from there), and any shortfall beyond the transfer is suggested as usual. A transfer after the snapshot year moves the snapshot's lots normally. A transfer row with the same account at both ends or a quantity ≤ 0 is ignored with a `transfer-invalid` warning.
- **Shortfalls.** A sell larger than the account's holding no longer throws. The missing shares have cost 0 and the sell is flagged `costBasisMissing`. If another account held the instrument at that time the app shows `transfer-suggested` (move the shares from that account); otherwise `shortfall-add-carry-in` (a carry-in is missing). Nothing is moved automatically (the user adds a transfer). Warnings are aggregated per (account, instrument, kind) with summed quantities and the earliest date, and a donor's holding is offered only once. Once a queue has had a shortfall (in any period), every later sell from it is also flagged `costBasisMissing`, because its remaining lots are likely mis-ordered.
- Each lot remembers its `acquiredAt` (buy date, or the carry-in placement date).

**Only sells within the tax period** are recorded as results. Buys and sells outside the period still affect the FIFO queue state (they are "processed through" to maintain correct lot ordering).

**Example:**

- Buy 100 AAPL on Jan 1 at $150 (NBP rate 4.0) → costPerSharePln = 600 PLN
- Buy 50 AAPL on Jan 15 at $160 (NBP rate 4.1) → costPerSharePln = 656 PLN
- Sell 120 AAPL on Jan 20 at $170 (NBP rate 4.05), commission $10

```
proceedsPln        = 120 × 170 × 4.05 = 82,620 PLN (gross)
sellCommissionPln  = 10 × 4.05 = 40.50 PLN

FIFO lot 1: 100 shares × 600 PLN = 60,000 PLN (+ buy commission)
FIFO lot 2:  20 shares × 656 PLN = 13,120 PLN (+ buy commission)
totalCostPln = 73,120 PLN + buy commissions + 40.50 sell commission

gainLossPln = 82,620 − totalCostPln
```

#### Employee incentive shares (RSU / ESPP)

Polish law has two regimes for shares received under an employee incentive programme, and the app cannot tell which one applies to you. You choose it per lot on **Data → Trades** (a bulk action sets it for all RSU / ESPP lots of a symbol):

- **Qualifying** — a programme of the company or its parent under a shareholders' resolution ([art. 24 ust. 11–12b](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/)). There is no income at acquisition; the cost on sale is the price actually paid plus commission (0 for RSU, the discounted price for ESPP).
- **Taxed at acquisition** — the vest or purchase was taxed as income (for example on a PIT-11). The cost on sale is the price paid plus commission plus the income already taxed ([art. 23 ust. 1 pkt 38](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-23/)). Enter that income in PLN (`taxedIncomePln`, total for the lot); if left empty it is derived as (FMV per share − price) × quantity × the NBP rate of the vest date (last business day before it). That income always uses the vest-date rate, even when the settlement-date option is on for trades. With neither, the cost is missing.

There is **no default**. A buy lot with source `rsu` / `espp` and no regime costs only the price paid (0 for RSU) and is flagged as cost-missing, exactly like a carry-in without a cost: every sale that consumes it is `costBasisMissing`, the tax form is a draft and copying is disabled. Rows saved before this feature have no regime, so they become cost-missing until you choose. The extra cost is folded into the lot's per-share cost, so splits and mergers carry it, and the missing flag, unchanged.

The Schwab parser records the vest FMV (`incentive.fmvPerShare`) for RSU lapses (price paid 0) and ESPP deposits, and warns when shares were sold or withheld for taxes (sell-to-cover). IBI statements carry no FMV, so only the price paid is imported. Sessions with Schwab statements imported before this feature show a dismissible notice. Legacy Schwab rows cannot be told apart reliably and importing a file twice duplicates its rows, so the notice asks the user to import all statements into a new session (or delete the old Schwab trades first).

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
- **Sell commission in PLN:** `commission × NBP_rate_from_day_before_sell`, added to the cost of that sell (PIT-38 poz. 23)
- Buy price and buy commission are stored per-share in the FIFO lot and consumed proportionally on sell

**What counts as proceeds (przychody):**

- **Gross sell proceeds in PLN:** `proceeds × NBP_rate_from_day_before_sell` (poz. 22). The sell commission is not subtracted here; it is a cost (see above)

**Rounding:** Tax base and tax owed are rounded to full złoty using mathematical rounding ([art. 63 § 1 Ordynacji podatkowej](https://lexlege.pb.pl/ordynacja-podatkowa/art-63/) — amounts ending in less than 50 groszy are discarded, 50 groszy and above are rounded up to the next full złoty).

---

### 5. Dividend Tax (19%) with treaty-based credit cap

**Legal basis:**

- [Art. 30a ust. 1 pkt 4 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) — foreign dividends are taxed at a flat 19% (zryczałtowany podatek dochodowy).
- [Art. 30a ust. 2 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) — the rate is applied with regard to applicable double-tax treaties (UPO).
- [Art. 30a ust. 9 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) — domestic cap: the credit cannot exceed the 19% rate applied to gross income.
- [Art. 30a ust. 11 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) — foreign flat-rate tax under art. 30a ust. 1 pkt 1-5 and the foreign tax paid under ust. 9 are reported in the tax return.
- [Official PIT-38 guidance on podatki.gov.pl](https://www.podatki.gov.pl/pit/twoj-e-pit/pit-38-za-2024) — identifies foreign art. 30a ust. 1 pkt 1-5 income, including dividends, as the source for the PIT-38 flat-rate tax and foreign-tax-credit fields.

**Exact algorithm** (`dividends.ts` + `calculator.ts` + `treaty-rates.ts`):

**Step 1 — Group rows per dividend event and match withholding taxes.**

Dividend rows, withholding tax rows and (optionally) ADR fees are grouped by a composite key: `YYYY-MM-DD:ISIN:CURRENCY` (or `YYYY-MM-DD:SYMBOL:CURRENCY` if ISIN is unavailable). All dividend rows with the same key form one dividend event, so a payment that the broker posts, reverses and re-posts on the same day (`100`, `-100`, `100`) is netted to a single event of `100`. Matched withholding taxes and ADR fees are counted once per event, regardless of how many dividend rows it has.

**Dividend country (ADRs and payments in lieu).** Art. 30a ust. 9 updof limits the credit by the treaty with the _source state_ of the dividend:

- **ADR ordinary dividends:** for IBKR instruments whose Financial Instrument Information `Type` column is `ADR` (the column is optional; absent means not an ADR), the issuer country is read from the ordinary-dividend withholding description suffix (`TSM(US8740391003) Cash Dividend ... - TW Tax` → `TW`; only a trailing uppercase 2-letter code is accepted). It replaces the ISIN country for dividends only, but a user override always wins. If the suffixes disagree (within a statement or across statements) no country is learned: the ISIN country is kept and the user is warned. Without a suffix on a withholding row the ISIN country is kept and an import warning asks the user to set the issuer country on the country mapping page. The W-8BEN lapse warning is suppressed for ADR rows whose resolved country is not US.
- **Payment in lieu of dividend:** rows whose description contains "Payment in Lieu of Dividend" are separate events (`kind` is part of the grouping key), never feed ADR learning, and take their country from the `- XX Tax` suffix of their matched withholding row (US gives the US 15% cap); with no withholding they fall back to the ISIN country. **A user override always wins, except for payments in lieu, whose country is the state that withheld the tax** (crediting US-withheld tax under another treaty's cap would be contestable on audit). The dashboard names that country in the event's warning, and the country mapping page notes it under the treaty rate. Rows imported before `kind` existed are treated as ordinary dividends; re-import the statement to separate legacy payment-in-lieu rows. They never get the W-8BEN warning: withholding above the treaty rate is flagged as "the excess is not credited", and every such event carries an informational note that a payment in lieu is a substitute payment, not an issuer dividend, so its tax treatment should be checked.

**Step 2 — Net amounts and convert each event to PLN.**

Sign convention: dividend amounts are positive for payments and negative for reversals; withholding amounts are **negative for tax withheld** and **positive for refunds/reversals** (as in the Interactive Brokers CSV).

```
For each dividend event in the tax period:
    amountOriginal          = max(sum of dividend.amount − ADR fees, 0)
    amountPln               = amountOriginal × dividend.exchangeRate
    withholdingTaxOriginal  = max(−sum of tax.amount, 0)
    withholdingTaxPln       = max(−sum of (tax.amount × tax.exchangeRate), 0)
```

Only the dividend actually received is income ([art. 30a ust. 1 pkt 4](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/)) and only tax actually paid abroad can be credited ([art. 30a ust. 9](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/)), so a refunded withholding (`-15`, `+15`) nets to 0. Each withholding tax entry may have its own exchange rate (the NBP rate from the last business day before the withholding date). If dividend rows in one event have different rates, PLN amounts are summed per row.

Two non-fatal warnings flag suspicious nets: **net-negative** (the event's dividend rows sum below zero — usually a reversal dated differently from the original payment; the amount is floored to 0) and **wht-net-refund** (refunds exceed withholding — often a withheld amount entered as a positive number; withholding is floored to 0). Reversals posted on a different date than the original payment are not netted yet.

**Step 3 — Per-dividend credit cap** (applied in `buildSummary`):

The cap rate per dividend is the **lower of** the applicable treaty rate (from `TREATY_DIVIDEND_RATE_MAP` in `src/core/tax/treaty-rates.ts`) and the domestic 19% rate. For countries without a mapped treaty, the fallback is 19%.

```
capRate               = min(treatyRate(country) ?? 0.19, 0.19)
deductibleWithholding = min(withholdingTaxPln, amountPln × capRate)

totalDeductibleWithholdingPln = sum of deductibleWithholding for all dividends
dividendTaxOwedPln = max(totalDividendsPln × 0.19 − totalDeductibleWithholdingPln, 0)
```

Mapped treaty rates (portfolio / default column — the higher rate from each "X/Y" treaty entry, since individual investors virtually never hold the ≥10–25 % stakes required to unlock the reduced rate). Data source: [PwC Worldwide Tax Summaries — Poland, Withholding taxes](https://taxsummaries.pwc.com/poland/corporate/withholding-taxes). Cross-reference the full official list: [Wykaz umów o unikaniu podwójnego opodatkowania — Ministerstwo Finansów](https://www.podatki.gov.pl/podatkowa-wspolpraca-miedzynarodowa/wykaz-umow-o-unikaniu-podwojnego-opodatkowania/).

| ISO | Country              | Rate | ISO | Country         | Rate | ISO | Country         | Rate |
| --- | -------------------- | ---- | --- | --------------- | ---- | --- | --------------- | ---- |
| AE  | United Arab Emirates | 5 %  | GB  | United Kingdom  | 10 % | MY  | Malaysia        | 5 %  |
| AL  | Albania              | 10 % | GE  | Georgia         | 5 %  | NG  | Nigeria         | 10 % |
| AM  | Armenia              | 10 % | GR  | Greece          | 19 % | NL  | Netherlands     | 15 % |
| AT  | Austria              | 15 % | HR  | Croatia         | 15 % | NO  | Norway          | 15 % |
| AU  | Australia            | 15 % | HU  | Hungary         | 10 % | NZ  | New Zealand     | 15 % |
| AZ  | Azerbaijan           | 10 % | ID  | Indonesia       | 15 % | PH  | Philippines     | 15 % |
| BA  | Bosnia & Herzegovina | 15 % | IE  | Ireland         | 15 % | PK  | Pakistan        | 15 % |
| BD  | Bangladesh           | 15 % | IL  | Israel          | 10 % | PT  | Portugal        | 15 % |
| BE  | Belgium              | 10 % | IN  | India           | 10 % | QA  | Qatar           | 5 %  |
| BG  | Bulgaria             | 10 % | IR  | Iran            | 7 %  | RO  | Romania         | 15 % |
| BR  | Brazil               | 15 % | IS  | Iceland         | 15 % | RS  | Serbia          | 15 % |
| BY  | Belarus              | 15 % | IT  | Italy           | 10 % | SA  | Saudi Arabia    | 5 %  |
| CA  | Canada               | 15 % | JO  | Jordan          | 10 % | SE  | Sweden          | 15 % |
| CH  | Switzerland          | 15 % | JP  | Japan           | 10 % | SG  | Singapore       | 10 % |
| CL  | Chile                | 15 % | KG  | Kyrgyzstan      | 10 % | SI  | Slovenia        | 15 % |
| CN  | China                | 10 % | KR  | Korea (South)   | 10 % | SK  | Slovak Republic | 5 %  |
| CY  | Cyprus               | 5 %  | KW  | Kuwait          | 5 %  | SY  | Syria           | 10 % |
| CZ  | Czech Republic       | 5 %  | KZ  | Kazakhstan      | 15 % | TH  | Thailand        | 19 % |
| DE  | Germany              | 15 % | LB  | Lebanon         | 5 %  | TJ  | Tajikistan      | 15 % |
| DK  | Denmark              | 15 % | LK  | Sri Lanka       | 10 % | TN  | Tunisia         | 10 % |
| DZ  | Algeria              | 15 % | LT  | Lithuania       | 15 % | TR  | Turkey          | 15 % |
| EE  | Estonia              | 15 % | LU  | Luxembourg      | 15 % | TW  | Taiwan          | 10 % |
| EG  | Egypt                | 12 % | LV  | Latvia          | 15 % | UA  | Ukraine         | 15 % |
| ES  | Spain                | 15 % | MA  | Morocco         | 15 % | US  | United States   | 15 % |
| ET  | Ethiopia             | 10 % | MD  | Moldova         | 15 % | UY  | Uruguay         | 15 % |
| FI  | Finland              | 15 % | ME  | Montenegro      | 15 % | UZ  | Uzbekistan      | 15 % |
| FR  | France               | 15 % | MK  | North Macedonia | 15 % | VN  | Vietnam         | 15 % |
|     |                      |      | MN  | Mongolia        | 10 % | ZA  | South Africa    | 15 % |
|     |                      |      | MT  | Malta           | 10 % | ZM  | Zambia          | 15 % |
|     |                      |      | MX  | Mexico          | 15 % | ZW  | Zimbabwe        | 15 % |

Notes:

- Greece (GR) — the treaty's dividend rate equals the Polish domestic 19 %, so there is effectively no foreign-credit benefit.
- Thailand (TH) — treaty rate is 20 %; stored at 19 % because the domestic cap applies anyway.
- Rates reflect the **portfolio** column (default, higher) from each treaty. Reduced inter-company rates (typically requiring ≥10–25 % ownership for 12–24 months) are intentionally not used by kloPIT.

All other countries (including unknown `XX`) fall back to the domestic 19 % cap. Excess withholding above the treaty rate is **not** deductible in Poland — taxpayers must reclaim it from the foreign tax authority.

The per-dividend cap ensures that excess foreign tax on one dividend **cannot** offset tax owed on another dividend.

**Mathematical equivalence note:** Since `min(w, d × capRate) ≤ d × 0.19` for every dividend, the per-dividend owed amount is always ≥ 0, making the aggregate formula equivalent to summing per-dividend results.

#### ADR/GDR/CDI fee handling

Interactive Brokers Activity Statements may include depositary-receipt fees in the `Change in Dividend Accruals` section with `ADR` codes. kloPIT imports those rows as transaction fees when they relate to ADR/GDR/CDI instruments, but **does not reduce the dividend tax base by default**.

Why kloPIT handles them this way:

| Decision / assumption                                                                                                                                                                  | Grounding                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR/GDR/CDI accrual rows are real broker-account fees, not parser noise.                                                                                                               | IBKR documents ADR/GDR/CDI fees as pass-through custody/depository charges assessed to accounts holding the receipt on the record date: [IBKR Other Fees — ADR/GDR/CDI Fees](https://www.interactivebrokers.com/en/pricing/other-fees.php).                                                                     |
| A fee that IBKR reports as a separate cash-account debit is treated separately from the dividend payment unless the user chooses otherwise.                                            | IBKR's fee page describes separate pass-through charges and recommends checking the instrument prospectus, so the statement row is imported as a fee instead of silently folding it into a dividend amount: [IBKR Other Fees — ADR/GDR/CDI Fees](https://www.interactivebrokers.com/en/pricing/other-fees.php). |
| Default behavior is conservative: do not reduce the Polish art. 30a dividend base by ADR/GDR/CDI fees.                                                                                 | Polish PIT art. 30a ust. 1 pkt 4 covers dividends, and art. 30a ust. 6 states that the flat-rate tax for the listed income types is collected without reducing revenue by tax-deductible costs: [PIT Act art. 30a](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/).                 |
| Foreign dividend tax and foreign tax credit remain in PIT-38 section G.                                                                                                                | The Ministry of Finance PIT-38 guidance for 2025 describes foreign art. 30a income, including dividends, and the art. 30a ust. 9 foreign-tax-credit cap: [podatki.gov.pl — PIT-38 za 2025 rok](https://www.podatki.gov.pl/twoj-e-pit/pit-38-za-2025-rok/).                                                      |
| An opt-in setting exists because a user may have broker/prospectus/tax-advisor evidence that the fee should be treated as reducing a specific dividend rather than as a separate cost. | IBKR points users to the ADR/GDR/CDI prospectus for fee details, while the Polish sources above do not directly resolve every broker-reporting pattern. The setting keeps this judgment explicit and auditable.                                                                                                 |

When the setting **Reduce dividends by matched ADR/GDR fees** is enabled, kloPIT matches an ADR/GDR/CDI fee to a dividend only by the same payment date and the same ISIN or symbol, and only in the same currency. The reduction is capped at the dividend amount, so it cannot create a negative dividend base.

**Example with US dividend (treaty cap at 15%):**

- Dividend: 100 PLN gross, broker withheld 19 PLN (≈19%, over the treaty rate).
  - Cap: min(15%, 19%) × 100 = 15 PLN
  - Deductible: min(19, 15) = **15 PLN** (4 PLN excess lost in PL — recover abroad)
  - To pay in PL: 100 × 19% − 15 = **4 PLN**

**Example with mixed amounts (same country, US):**

- Dividend A: 100 PLN gross, 30 PLN withheld.
  - Deductible: min(30, 100 × 0.15 = 15) = **15 PLN**
  - To pay: 19 − 15 = **4 PLN**
- Dividend B: 100 PLN gross, 0 PLN withheld.
  - Deductible: min(0, 15) = **0 PLN**
  - To pay: 19 − 0 = **19 PLN**
- **Total to pay: 23 PLN** (pooling would incorrectly yield 38 − 30 = 8 PLN).

---

### 6. Credit Interest Tax (19%)

**Legal basis:** [Art. 30a ust. 1 pkt 3 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) — interest on cash deposited with a broker is taxed at a flat 19% rate (zryczałtowany podatek dochodowy).

**Implementation:** `credit-interest.ts`

Credit interest is broker-paid interest on uninvested cash balances (e.g., "USD Credit Interest for Dec-2024"). It is **not** bond coupon interest and **not** Purchase Accrued Interest.

**Parser rules:**

- Only rows with `Credit Interest for` in the description and positive amounts are captured
- `Purchase Accrued Interest` rows are excluded per [art. 30a ust. 6](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) (no cost deduction allowed for flat-rate income)
- Debit interest and other interest types are recorded as skipped rows

**Per-row calculation:**

```
amountPln       = amount × exchangeRate (NBP rate from last business day before payment date)
taxPlnGross     = amountPln × 0.19
foreignTaxPln   = 0 (IBKR LLC — US portfolio interest exemption)
```

**IBKR entity detection:** The parser reads `Statement,Data,BrokerName` from the CSV to determine the IBKR entity (e.g., "Interactive Brokers LLC" → US). This maps to the broker's country for future withholding tax support (IBIE Ireland clients may have WHT).

**PIT-38 treatment:** Credit interest goes to Section G alongside dividends. The 19% tax is combined with dividend tax in poz. 47, and any foreign tax credit would be included in poz. 48.

---

### 7. Rounding Rules

**Implementation:** `rounding.ts`

Two distinct rounding functions are used, matching separate legal provisions:

| Function         | Legal basis                                                                                                           | Algorithm                                                    | Used for                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `roundToFullPln` | [Art. 63 § 1 Ordynacji podatkowej](https://lexlege.pb.pl/ordynacja-podatkowa/art-63/)                                 | Half-up rounding to full złoty (under 50 gr dropped)         | Tax base (poz. 31), capital gains tax due (poz. 35), dividend part of poz. 49, crypto placeholders (poz. 41/45), monthly placeholder fields |
| `roundToGrosz`   | Form field precision (`zł, gr`)                                                                                       | `Math.round((amount + EPSILON) × 100) / 100` — nearest grosz | PIT-38 Section C totals/gain/loss (poz. 22/23/26/27/28/29), dividend tax/credit parts of poz. 47/48, payment summary (poz. 51/52)           |
| `roundToGroszUp` | [Art. 63 § 1a Ordynacji podatkowej](https://lexlege.pb.pl/ordynacja-podatkowa/art-63/) — art. 30a ust. 1 pkt 1–3 only | `Math.ceil(amount × 100) / 100` — ceiling to full groszy     | Interest part (art. 30a ust. 1 pkt 3) of poz. 47 and 49 — base and tax                                                                      |

**`roundToGroszUp` precision handling:** Uses `+(amount * 100).toFixed(10)` before `Math.ceil` to avoid floating-point artifacts (e.g., `0.1 + 0.2 = 0.30000000000000004`).

**PIT-38 Section G rounding note:** the MF PIT-38 (2025) guide, part G, says amounts in `poz. 46` and `poz. 49` are given in full złoty, except under [art. 63 § 1a OP](https://lexlege.pb.pl/ordynacja-podatkowa/art-63/) for income under art. 30a ust. 1 pkt 1–3, which is rounded up to full groszy. § 1a does not cover pkt 4 (dividends). kloPIT therefore computes section G per component (`sectionGForeignFlatTax`): the dividend part of `poz. 49` is rounded half-up to full złoty (art. 63 § 1), the interest part (pkt 3) is rounded up to the grosz (base and tax), and `poz. 49` is the sum. `poz. 47`/`poz. 48` are the sums of the per-part tax and credit; `poz. 51-52` stay at grosz precision.

---

### 8. PIT-38 Form Mapping (PIT-38(18))

**Implementation:** `pit38.ts`

The `buildPit38()` function maps aggregated tax data to the official PIT-38(18) form fields. Here is the exact computation for each populated field:

**Official grounding for field precision and labels:**

- [PIT-38 (18) form page on podatki.gov.pl](https://www.podatki.gov.pl/podatki-osobiste/pit/formularze/) and the linked [official PIT-38(18) PDF](https://www.gov.pl/attachment/1874d956-4063-4a9c-a65c-ab7b6bc7aa30)
- [Official PIT-38 brochure for 2025](https://www.podatki.gov.pl/media/g5ebnm2e/broszura-do-pit-38-za-2025-r.pdf)

The official PIT-38(18) form distinguishes between two kinds of amount fields:

- `zł, gr` fields: for example `poz. 20-30`, `33-34`, `36-40`, `43-44`, `47-49`
- full-PLN fields: for example `poz. 31`, `35`, `41`, `45`, and monthly fields in section `H`

This matters for UI copy/paste helpers: values copied into e-Urząd Skarbowy should match the precision implied by the official field label, not the internal floating-point representation used during intermediate calculations.

#### Section C — Capital Gains/Losses ([art. 30b ust. 1](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30b/))

```
poz20 = 0                                    // PIT-8C proceeds (N/A for foreign broker)
poz21 = 0                                    // PIT-8C costs
poz22 = roundToGrosz(totalProceedsPln)       // Other proceeds (foreign broker)
poz23 = roundToGrosz(totalCostPln)           // Other costs
poz24 = 0                                    // Exempt proceeds (art. 21 ust. 1 pkt 105a)
poz25 = 0                                    // Exempt costs
poz26 = roundToGrosz(poz20 + poz22 − poz24)  // Total proceeds
poz27 = roundToGrosz(poz21 + poz23 − poz25)  // Total costs
poz28 = roundToGrosz(max(poz26 − poz27, 0))  // Gain (dochód)
poz29 = roundToGrosz(max(poz27 − poz26, 0))  // Loss (strata)
```

#### Section D — Tax Calculation

```
poz30 = applyLossCarryForward(priorLosses, poz28).deductedPln  // Prior-year loss deduction
poz31 = roundToFullPln(max(poz28 − poz30, 0))  // Tax base (podstawa obliczenia podatku)
poz33 = poz31 × 0.19                        // Tax amount (podatek)
poz34 = 0                                    // Foreign tax on capital gains (not applicable)
poz35 = roundToFullPln(max(poz33 − poz34, 0))  // Tax due (podatek należny)
```

`applyLossCarryForward` enforces the 5-year window and 50%-per-year cap per loss entry — see Section 10.

#### Sections E & F — Crypto (placeholders, all zeros)

Not yet implemented. Fields poz36–poz45 are set to 0.

#### Section G — Payment Summary (Dividends + Credit Interest)

**Grounding:**

- PIT-38(18) `poz. 46` is for art. 29, 30, and 30a flat-rate tax not collected by a payer, excluding the tax shown separately in `poz. 47`, `poz. 48`, and section H. kloPIT currently leaves this at `0` because supported dividends and credit interest are routed to `poz. 47-49`.
- PIT-38(18) `poz. 47` is the flat-rate tax from foreign art. 30a ust. 1 pkt 1-5 income (the form's scope; § 1a rounding applies only to pkt 1–3). This includes dividends under art. 30a ust. 1 pkt 4 and supported broker credit interest under art. 30a ust. 1 pkt 3.
- PIT-38(18) `poz. 48` is foreign tax paid under art. 30a ust. 9, converted to PLN and capped per part (art. 30a ust. 9) so each credit cannot exceed its own part's tax.
- PIT-38(18) `poz. 49` is the difference `poz. 47 - poz. 48`, computed per component: dividend difference to full złoty (art. 63 § 1), interest difference up to the grosz (art. 63 § 1a).
- PIT-38(18) `poz. 51` is `max(poz35 + poz45 + poz46 + poz49 - poz50, 0)`.

```
poz46 = 0                                                        // Other flat-rate tax (not applicable)
divTax    = roundToGrosz(totalDividendsPln × 0.19)
divCredit = roundToGrosz(min(totalDeductibleWithholdingPln, divTax))     // art. 30a ust. 9
intTax    = roundToGroszUp(roundToGroszUp(totalCreditInterestPln) × 0.19) // art. 63 § 1a
intCredit = roundToGrosz(min(totalCreditInterestForeignTaxPln, intTax))
poz47 = divTax + intTax                                          // Foreign flat-rate tax (19%)
poz48 = divCredit + intCredit                                    // Deductible foreign tax
poz49 = roundToFullPln(roundToGrosz(max(divTax − divCredit, 0)))  // dividends: art. 63 § 1
      + roundToGroszUp(max(intTax − intCredit, 0))               // interest:  art. 63 § 1a
poz50 = 0                                                        // Advance payments by payers
poz51 = roundToGrosz(max(poz35 + poz45 + poz46 + poz49 − poz50, 0))  // TAX TO PAY
poz52 = roundToGrosz(max(poz50 − (poz35 + poz45 + poz46 + poz49), 0))  // OVERPAYMENT
```

#### Section J — OPP 1.5% Request

```
poz66 = selected OPP KRS
poz67 = 1.5% × (poz35 + supported poz45), rounded down to full 10 groszy
poz68 = optional specific purpose
poz69 = consent to pass taxpayer details and poz67 amount to the OPP
```

kloPIT does not currently calculate crypto Section F, so supported `poz45` is always 0 and `poz67` is effectively based on `poz35`.
The amount is computed in integer grosze (`src/core/tax/opp.ts`) so float error can never drop it by 10 groszy (e.g. 180 zł → 2.70, not 2.60).

#### Sections H & I — Monthly Flat-Rate Tax (placeholders, all zeros)

Not yet implemented. Fields poz53–poz65 are set to 0.

---

### 9. PIT/ZG Attachment (Per-Country)

**Implementation:** `pit-zg.ts`

**Legal basis:** [Art. 45 ust. 1a ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45/) and PIT/ZG(8) section C.3 — PIT/ZG is filed per country, but only for income under art. 30b where foreign tax is credited (art. 30b ust. 5a/5b).

**Official grounding for field precision and labels:**

- [PIT/ZG page on gov.pl](https://www.gov.pl/web/finanse/pitzg)
- [Official PIT/ZG(8) PDF](https://www.gov.pl/attachment/213803ec-f7e6-4b15-b643-e25dc145e2bd)

The official PIT/ZG(8) form labels the reported income/tax amount boxes as `zł, gr`, so these values should be normalized to grosz precision when displayed or copied for filing.

**Default behavior:**

PIT/ZG is generated from sell trades by country. In the PIT/ZG view:

- item 6 is the Polish country name
- item 7 is the country code
- item 29 is income from abroad (positive net gain for that country)
- item 30 is tax paid abroad on the item 29 income

If item 29 is zero, item 30 is also shown as zero because it is tax paid abroad from the income in item 29.

**Required vs. informational:** `PitZgFields.required` is `true` only when the **credited** foreign tax is above 0 (art. 30b ust. 5a/5b updof; MF PIT-38 brochure, Część L: "do których ma zastosowanie metoda odliczenia podatku zapłaconego za granicą"; PIT/ZG(8) header). `creditableForeignTaxPln = min(tradeForeignTaxPln, 19% × country gain, polish tax due × country gain / Σ country gains)`, where the Polish tax due is `summary.capitalGainTaxPostLcfPln` (after section D offsets and loss carry-forward). So a country with a net loss, an overall loss, or a carry-forward that brings the tax to 0 gets credit 0 and is not required. Countries that are not required stay in the list with `required: false`; the tax form lists them separately and muted, and `requiredPitZg()` returns only the required ones. `TradeResult.foreignTaxPln` is currently always 0 for gains (nothing sets it), so today every capital-gains row is informational; the logic is general and a non-zero value makes the country required.

**Known gap:** the proportional split of the Polish tax across countries is an approximation of the per-country limit in art. 30b ust. 5a; it does not model, for example, which country's gains a carry-forward loss was set against. It only affects whether credit is 0 or not in edge cases and is irrelevant while no foreign tax on gains is recorded.

Foreign dividends are art. 30a flat-rate income and stay in PIT-38 section G by default. They do not create PIT/ZG entries unless the user enables the compatibility setting.

**Optional dividend compatibility setting:**

The `/settings` page exposes **Show dividends in PIT/ZG**, disabled by default. When enabled, PIT/ZG also shows informational dividend rows (never required: PIT/ZG has no dividend field), next to the official PIT-38 section G values. This setting is intentionally narrow and does not replace the official PIT-38 section G dividend calculation.

**Country determination:** Extracted from the ISIN prefix (first 2 characters, ISO 3166-1 alpha-2), plus manual overrides from the country mapping table. Dividend ISIN mappings are reused for the same symbol when trade rows lack a usable ISIN country or resolve to `XX`. The displayed country name is always generated in Polish, regardless of app language, to match the official Polish form.

**Algorithm:**

```
For each sell trade:
    Group by country
    proceedsPln          += trade.proceedsPln
    costPln              += trade.costPln
    tradeForeignTaxPln   += trade.foreignTaxPln

For each country:
    gainPln = max(proceedsPln − costPln, 0)
    lossPln = max(costPln − proceedsPln, 0)
    If gainPln == 0:
        tradeForeignTaxPln = 0
    cap = min(19% * gainPln, polishTaxDue * gainPln / Σ gainPln)
    creditableForeignTaxPln = min(tradeForeignTaxPln, cap)
    required = creditableForeignTaxPln > 0

If showDividendsInPitZg:
    For each dividend:
        Group by country
        dividendIncomePln        += div.amountPln
        dividendForeignTaxPln    += div.withholdingTaxPln
        deductibleDividendTaxPln += div.deductibleWithholdingPln
```

Results are sorted alphabetically by country code.

---

### 10. Prior Year Losses (Carry-Over)

**Implementation:** `src/core/tax/loss-carry-forward.ts`

**Legal basis:** [Art. 9 ust. 3 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-9/) — losses from a given income source can be carried forward for up to **5 consecutive tax years** following the year in which they were incurred, with a cap of **50% of the original loss per year** (art. 9 ust. 3 pkt 1).

> _Option 2_ (one-shot deduction up to 5,000,000 PLN, art. 9 ust. 3 pkt 2) is **not** supported by the calculator. Users who qualify can still enter an equivalent gradual deduction schedule manually.

**Data model:** Each loss is recorded as a `PriorYearLoss { year, totalLossPln, alreadyDeductedPln }` in the `priorLosses` Dexie table, scoped per session. The `/prior-losses` page provides CRUD for these rows; `alreadyDeductedPln` tracks the residual consumed across prior tax years.

**Algorithm (`applyLossCarryForward`):**

```
For each priorLoss (oldest year first):
    ageInYears = currentYear − loss.year
    expired    = ageInYears > 5 || ageInYears <= 0
    cap        = expired ? 0 : floorToGrosz(min(0.5 × loss.totalLossPln,
                                    loss.totalLossPln − loss.alreadyDeductedPln))
    deducted   = min(cap, remainingGain)
    remainingGain −= deducted
    loss.alreadyDeductedPln += deducted  // returned in updatedLosses

poz30 = sum of deducted across all priorLosses
```

**Guarantees:**

- Losses older than 5 years or newer than the tax session are silently skipped (a warning is attached for residuals lost to expiration).
- The 50%-per-year cap is enforced per loss year — a user entering 100% of a loss as "already deducted" previously still has their residual constrained by `0.5 × totalLossPln`.
- The gain being reduced is the declared, grosz-rounded poz. 28 (not the unrounded sum of trades), and each cap is floored to the grosz, so poz. 30 is always a whole zł/gr amount that never exceeds 50% of any loss.
- `computeLossDeduction` (`src/core/tax/pit38.ts`) is the single production caller of `applyLossCarryForward`; its result feeds poz. 30, the per-year breakdown and the dashboard's post-LCF figures, so they always agree.
- The per-year breakdown (`perYear`) is persisted on the `taxSummary.lossDeduction` record and rendered in Section D of the PIT-38 form.

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
   - Imported from broker statements (e.g. IBKR Mark-to-Market prior quantity) without a cost; add the acquisition date and cost basis on the Data page, or confirm a zero cost for shares from a qualifying incentive program
   - Sales of carry-ins without a cost are flagged as "cost missing"

6. **Credit Interest**
   - Interest earned on uninvested cash balances
   - Currency and payment date
   - Only credit interest (positive amounts) — debit interest and purchase accrued interest are excluded

### How import warnings work

IBKR Activity Statements contain many section types. kloPIT now classifies every section header into four buckets:

- **Supported** — parsed into app data (`Trades`, `Dividends`, `Withholding Tax`, `Corporate Actions`, carry-in positions, statement year, symbol-to-ISIN mapping)
- **Ignorable** — safely skipped because they are statement metadata or redundant summaries
- **Known unsupported** — not parsed yet, but shown to you explicitly
- **Unknown** — unrecognized section names, also shown explicitly

This means the app no longer silently drops entire unsupported sections such as `Options`, `Futures`, `Forex P/L`, `Interest`, or `Fees`.

### What counts as a warning

Warnings appear in two situations:

1. A whole section is present but not supported yet
2. A row inside a supported section fails to parse cleanly

Rows skipped **by design** do not trigger warnings. For example:

- IBKR `Header`, `SubTotal`, and `Total` rows
- Per-section summary rows like `Total in EUR`
- Non-stock rows inside stock-only import paths
- Carry-in rows with zero quantity
- Interest rows that are not credit interest (e.g., Debit Interest) — recorded as known-unsupported skipped rows

### Where skipped data is shown

After import, kloPIT shows warnings in two layers:

- **Persistent session summary** — the `/data` page stores grouped warning summaries on the tax-year session, so the amber banner survives reload
- **Detailed skipped rows** — the `Skipped` tab shows section, kind, line number, and raw CSV line, but only during the current in-browser import session

If you reload the page later, the summary warnings remain, but raw skipped-row detail is no longer available until you re-import the file.

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
- **Carry-in positions table:** Prior year shares with optional acquisition date, cost basis (original currency or PLN) and cost status
- **Credit interest table:** Interest earned on uninvested cash
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
2. **Resolve exchange rates** — For each transaction, fetch the NBP Table A average rate from the last business day before the event date. Each trade gets two rates (amount + commission), optionally based on estimated T+2 settlement dates when that session setting is enabled. Each dividend and withholding tax entry gets its own rate.
3. **Capital gains** (`calculateCapitalGains`):
   - Add carry-in positions to the timeline at their acquisition date with their PLN cost (missing cost counts as 0 and is flagged)
   - Build unified timeline of trades + corporate actions, sorted chronologically
   - Process each event: buys push lots, corporate actions modify lots, sells consume lots via FIFO
   - Record sell results with PLN amounts for trades within the tax period
4. **Dividends** (`calculateDividends`):
   - Match each dividend with its withholding tax entries by (date, ISIN/symbol) key
   - Convert amounts and withholding to PLN using their respective exchange rates
5. **Credit interest** (`calculateCreditInterest`):
   - Filter interest rows to the tax period
   - Convert each payment to PLN using NBP rate
   - Calculate 19% flat tax per row
   - Foreign tax is 0 for IBKR LLC (US portfolio interest exemption)
6. **Summary** (`buildSummary`):
   - Aggregate proceeds, costs, and capital gain from all sell trades
   - Aggregate dividend amounts and apply per-dividend withholding cap ([art. 30a ust. 9](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/))
   - Aggregate credit interest amounts and their 19% flat tax
   - Compute raw (unrounded) tax amounts for dashboard display
7. **PIT-38** (`buildPit38`):
   - Map summary values to form fields with proper rounding
   - Apply prior-year loss deduction via `applyLossCarryForward` (5-year window, 50%-per-year cap, FIFO across loss years)
   - Round Section C totals and gain/loss to grosz precision before deriving the tax base
   - Round tax base and tax due to full PLN ([art. 63 § 1](https://lexlege.pb.pl/ordynacja-podatkowa/art-63/))
   - Round section G per component: dividend difference to full złoty ([art. 63 § 1](https://lexlege.pb.pl/ordynacja-podatkowa/art-63/)), credit interest tax up to the grosz ([art. 63 § 1a](https://lexlege.pb.pl/ordynacja-podatkowa/art-63/), art. 30a ust. 1 pkt 1–3 only)
   - Keep poz. 51/52 at grosz precision because PIT-38(18) labels these fields as `zł, gr`
8. **PIT/ZG** (`buildPitZg`):
   - Group sell trades by country for PIT/ZG C.3 items 29/30
   - Use country names in Polish for item 6 and country codes for item 7
   - Reuse dividend ISIN mappings to fill a missing or unknown trade country for the same symbol
   - Optionally add dividend compatibility rows when `showDividendsInPitZg` is enabled
9. **Store & display** — Save all results to IndexedDB, update dashboard charts and form fields

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
- ✅ PIT/ZG C.3 attachment values for PIT-38 share income, required only where foreign tax on gains is credited
- ✅ OPP 1.5% Section J helper fields
- ✅ Credit interest (broker cash interest, art. 30a)
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
- Fill in the PIT/ZG attachment rows kloPIT marks as required (only countries where foreign tax on gains is credited)
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
A: Weekends and NBP holidays are normal: the app uses the last published rate before the event date, as art. 11a requires. If the required rate is not published yet (e.g. today's table, published around 12:15) or cannot be fetched, the affected rows are computed with rate 0 and flagged, the results are marked incomplete, and copying PIT-38 values is disabled. Recalculate later to fill them in.

**Q: Can I calculate taxes for multiple years at once?**  
A: Yes — create separate sessions for each year. Each calculates independently.

**Q: Is this an official tax form?**  
A: No. The app helps you calculate amounts and organize data. You still submit an official PIT-38 form to the tax authority.

**Q: What about CGT from selling at a loss?**  
A: Losses are tracked and can offset gains up to limits, or be carried forward 5 years at 50% per year.

---

## Legal References

Key Polish tax law provisions used in kloPIT calculations:

| Topic                                 | Legal basis                              | Link                                                                                                    |
| ------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| PIT-38 form obligation                | Art. 45 ust. 1a pkt 1 ustawy o PIT       | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45/)                 |
| Capital gains tax 19%                 | Art. 30b ust. 1 ustawy o PIT             | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30b/)                |
| Dividend tax 19%                      | Art. 30a ust. 1 pkt 4 ustawy o PIT       | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/)                |
| Credit interest tax 19%               | Art. 30a ust. 1 pkt 3 ustawy o PIT       | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/)                |
| Foreign tax deduction cap             | Art. 30a ust. 9 ustawy o PIT             | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/)                |
| FIFO method                           | Art. 24 ust. 10 ustawy o PIT             | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/)                 |
| Exchange rate conversion              | Art. 11a ust. 1 ustawy o PIT             | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-11a/)                |
| Loss carry-forward (5 years)          | Art. 9 ust. 3 ustawy o PIT               | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-9/)                  |
| Rounding to full PLN                  | Art. 63 § 1 Ordynacji podatkowej         | [lexlege.pl](https://lexlege.pb.pl/ordynacja-podatkowa/art-63/)                                         |
| Rounding up to full groszy (interest) | Art. 63 § 1a OP, art. 30a ust. 1 pkt 1–3 | [lexlege.pl](https://lexlege.pb.pl/ordynacja-podatkowa/art-63/)                                         |
| OPP 1.5% donation                     | Art. 45c ustawy o PIT                    | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45c/)                |
| Filing deadline (April 30)            | Art. 45 ust. 1 ustawy o PIT              | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45/)                 |
| PIT/ZG attachment                     | Art. 45 ust. 1a ustawy o PIT             | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45/)                 |
| US-Poland tax treaty (dividends)      | Art. 11 Konwencji PL-US                  | [isap.sejm.gov.pl](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19760310178)                  |
| DTT withholding rates (all countries) | Polish double-tax treaties (UPO)         | [PwC Worldwide Tax Summaries — Poland](https://taxsummaries.pwc.com/poland/corporate/withholding-taxes) |

**Full legal texts:**

- [Ustawa o podatku dochodowym od osób fizycznych (PIT)](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19910800350) — Dz.U. 1991 nr 80 poz. 350
- [Ordynacja podatkowa](https://lexlege.pl/ordynacja-podatkowa/) — Dz.U. 1997 nr 137 poz. 926

---

## Glossary

| Term                 | Meaning                                                                            |
| -------------------- | ---------------------------------------------------------------------------------- |
| **Credit Interest**  | Interest earned on uninvested cash held at a broker                                |
| **FIFO**             | First In, First Out — method to match sales with purchases                         |
| **NBP**              | Narodowy Bank Polski (Polish National Bank) — provides official exchange rates     |
| **PIT-38**           | Polish tax form for capital gains and dividends                                    |
| **PIT/ZG**           | Attachment to PIT-38 for foreign income with credited foreign tax — per country    |
| **OPP**              | Optional 1.5% request to transfer part of tax due to a public benefit organization |
| **Withholding Tax**  | Tax deducted by foreign broker (usually 15% US dividends)                          |
| **Carry-In**         | Shares owned from prior tax years                                                  |
| **Corporate Action** | Stock split, dividend spin-off, etc.                                               |
| **Session**          | One tax year's workspace (trades + dividends + results)                            |
| **IndexedDB**        | Browser database where your data is stored locally                                 |

---

## Verification & Transparency

kloPIT treats the PIT-38 form page as a **summary view** — every number is computed from rows you can inspect on the Dashboard.

**How to audit your numbers:**

- **Capital gains (Sections C + D)** — `/dashboard#trades` shows each closed trade with proceeds (PLN), FIFO-matched cost basis (PLN), gain/loss (PLN), and the 19% tax on that trade. Totals at the bottom of the table tie to `poz. 22` (proceeds), `poz. 23` (costs), `poz. 28` (gain) or `poz. 29` (loss). Prior-year loss deductions feeding `poz. 30` are broken down per-year in Section D.
- **Dividends and credit interest (Section G)** — `/dashboard#dividends` shows each dividend with PLN amount, effective foreign withholding %, the UPO-capped deductible %, and PL tax-to-pay %. Totals correspond to `poz. 47` (19% flat-rate tax), `poz. 48` (deductible foreign tax), and `poz. 49` (tax difference).
- **Rounding** — section C form totals (`poz. 22/23/26/27/28/29`) and payment summary (`poz. 51/52`) are rounded to grosz precision. The base and capital-gains tax due (`poz. 31`, `poz. 35`) are rounded to full PLN (`roundToFullPln`). `poz. 49` is computed per component: the dividend part is rounded to full złoty (`roundToFullPln`, art. 63 § 1) and the credit-interest part up to the grosz (`roundToGroszUp`, art. 63 § 1a, pkt 1–3 only); `poz. 47`/`poz. 48` are sums of the parts. See `src/core/tax/pit38.ts`, `src/core/tax/rounding.ts`, and `src/core/tax/aggregates.ts`.

**Parser architecture.** Imports run through `ParserDefinition` implementations in `src/core/parsers/` (Interactive Brokers CSV, IBI Capital PDF, manual entry). More brokers are on the roadmap — see `docs/ROADMAP.md`. Parser PRs are welcome.
