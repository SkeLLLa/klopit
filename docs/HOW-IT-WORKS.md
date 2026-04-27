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

You need **one PIT/ZG per country**. The country is inferred from ISIN country mappings, and dividend ISINs are reused to fill the country for the same symbol when trade rows do not have a usable ISIN country. When filing electronically via e-Urząd Skarbowy, PIT/ZG is generated as part of the PIT-38 form. kloPIT shows the values you need to fill in.

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
6. buildPitZg()             →  PitZgFields[]          (per-country PIT/ZG C.3 share income; optional dividend compatibility rows)
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

### 5. Dividend Tax (19%) with treaty-based credit cap

**Legal basis:**

- [Art. 30a ust. 1 pkt 4 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) — foreign dividends are taxed at a flat 19% (zryczałtowany podatek dochodowy).
- [Art. 30a ust. 2 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) — the rate is applied with regard to applicable double-tax treaties (UPO).
- [Art. 30a ust. 9 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) — domestic cap: the credit cannot exceed the 19% rate applied to gross income.
- [Art. 30a ust. 11 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) — foreign flat-rate tax under art. 30a ust. 1 pkt 1-5 and the foreign tax paid under ust. 9 are reported in the tax return.
- [Official PIT-38 guidance on podatki.gov.pl](https://www.podatki.gov.pl/pit/twoj-e-pit/pit-38-za-2024) — identifies foreign art. 30a ust. 1 pkt 1-5 income, including dividends, as the source for the PIT-38 flat-rate tax and foreign-tax-credit fields.

**Exact algorithm** (`dividends.ts` + `calculator.ts` + `treaty-rates.ts`):

**Step 1 — Match dividends with withholding taxes.**

Withholding taxes are grouped by a composite key: `YYYY-MM-DD:ISIN` (or `YYYY-MM-DD:SYMBOL` if ISIN is unavailable). Each dividend is matched to its withholding tax entries using the same key.

**Step 2 — Convert each dividend to PLN.**

```
For each dividend in the tax period:
    amountPln          = dividend.amount × dividend.exchangeRate
    withholdingTaxPln  = sum of (|tax.amount| × tax.exchangeRate) for matched taxes
```

Note: Interactive Brokers stores withholding amounts as negative numbers — `Math.abs()` is applied. Each withholding tax entry may have its own exchange rate (the NBP rate from the last business day before the withholding date).

**Step 3 — Per-dividend credit cap** (applied in `buildSummary`):

The cap rate per dividend is the **lower of** the applicable treaty rate (from `TREATY_DIVIDEND_RATE_MAP` in `src/core/tax/treaty-rates.ts`) and the domestic 19% rate. For countries without a mapped treaty, the fallback is 19%.

```
capRate               = min(treatyRate(country) ?? 0.19, 0.19)
deductibleWithholding = min(withholdingTaxPln, amountPln × capRate)

totalDeductibleWithholdingPln = sum of deductibleWithholding for all dividends
dividendTaxOwedPln = max(totalDividendsPln × 0.19 − totalDeductibleWithholdingPln, 0)
```

Mapped treaty rates (portfolio / default column — the higher rate from each "X/Y" treaty entry, since individual investors virtually never hold the ≥10–25 % stakes required to unlock the reduced rate). Data source: [PwC Worldwide Tax Summaries — Poland, Withholding taxes](https://taxsummaries.pwc.com/poland/corporate/withholding-taxes). Cross-reference the full official list: [Wykaz umów o unikaniu podwójnego opodatkowania — Ministerstwo Finansów](https://www.podatki.gov.pl/podatkowa-wspolpraca-miedzynarodowa/wykaz-umow-o-unikaniu-podwojnego-opodatkowania/).

| ISO | Country              | Rate | ISO | Country              | Rate | ISO | Country              | Rate |
| --- | -------------------- | ---- | --- | -------------------- | ---- | --- | -------------------- | ---- |
| AE  | United Arab Emirates | 5 %  | GB  | United Kingdom       | 10 % | MY  | Malaysia             | 5 %  |
| AL  | Albania              | 10 % | GE  | Georgia              | 5 %  | NG  | Nigeria              | 10 % |
| AM  | Armenia              | 10 % | GR  | Greece               | 19 % | NL  | Netherlands          | 15 % |
| AT  | Austria              | 15 % | HR  | Croatia              | 15 % | NO  | Norway               | 15 % |
| AU  | Australia            | 15 % | HU  | Hungary              | 10 % | NZ  | New Zealand          | 15 % |
| AZ  | Azerbaijan           | 10 % | ID  | Indonesia            | 15 % | PH  | Philippines          | 15 % |
| BA  | Bosnia & Herzegovina | 15 % | IE  | Ireland              | 15 % | PK  | Pakistan             | 15 % |
| BD  | Bangladesh           | 15 % | IL  | Israel               | 10 % | PT  | Portugal             | 15 % |
| BE  | Belgium              | 10 % | IN  | India                | 10 % | QA  | Qatar                | 5 %  |
| BG  | Bulgaria             | 10 % | IR  | Iran                 | 7 %  | RO  | Romania              | 15 % |
| BR  | Brazil               | 15 % | IS  | Iceland              | 15 % | RS  | Serbia               | 15 % |
| BY  | Belarus              | 15 % | IT  | Italy                | 10 % | SA  | Saudi Arabia         | 5 %  |
| CA  | Canada               | 15 % | JO  | Jordan               | 10 % | SE  | Sweden               | 15 % |
| CH  | Switzerland          | 15 % | JP  | Japan                | 10 % | SG  | Singapore            | 10 % |
| CL  | Chile                | 15 % | KG  | Kyrgyzstan           | 10 % | SI  | Slovenia             | 15 % |
| CN  | China                | 10 % | KR  | Korea (South)        | 10 % | SK  | Slovak Republic      | 5 %  |
| CY  | Cyprus               | 5 %  | KW  | Kuwait               | 5 %  | SY  | Syria                | 10 % |
| CZ  | Czech Republic       | 5 %  | KZ  | Kazakhstan           | 15 % | TH  | Thailand             | 19 % |
| DE  | Germany              | 15 % | LB  | Lebanon              | 5 %  | TJ  | Tajikistan           | 15 % |
| DK  | Denmark              | 15 % | LK  | Sri Lanka            | 10 % | TN  | Tunisia              | 10 % |
| DZ  | Algeria              | 15 % | LT  | Lithuania            | 15 % | TR  | Turkey               | 15 % |
| EE  | Estonia              | 15 % | LU  | Luxembourg           | 15 % | TW  | Taiwan               | 10 % |
| EG  | Egypt                | 12 % | LV  | Latvia               | 15 % | UA  | Ukraine              | 15 % |
| ES  | Spain                | 15 % | MA  | Morocco              | 15 % | US  | United States        | 15 % |
| ET  | Ethiopia             | 10 % | MD  | Moldova              | 15 % | UY  | Uruguay              | 15 % |
| FI  | Finland              | 15 % | ME  | Montenegro           | 15 % | UZ  | Uzbekistan           | 15 % |
| FR  | France               | 15 % | MK  | North Macedonia      | 15 % | VN  | Vietnam              | 15 % |
|     |                      |      | MN  | Mongolia             | 10 % | ZA  | South Africa         | 15 % |
|     |                      |      | MT  | Malta                | 10 % | ZM  | Zambia               | 15 % |
|     |                      |      | MX  | Mexico               | 15 % | ZW  | Zimbabwe             | 15 % |

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

| Decision / assumption | Grounding |
| --------------------- | --------- |
| ADR/GDR/CDI accrual rows are real broker-account fees, not parser noise. | IBKR documents ADR/GDR/CDI fees as pass-through custody/depository charges assessed to accounts holding the receipt on the record date: [IBKR Other Fees — ADR/GDR/CDI Fees](https://www.interactivebrokers.com/en/pricing/other-fees.php). |
| A fee that IBKR reports as a separate cash-account debit is treated separately from the dividend payment unless the user chooses otherwise. | IBKR's fee page describes separate pass-through charges and recommends checking the instrument prospectus, so the statement row is imported as a fee instead of silently folding it into a dividend amount: [IBKR Other Fees — ADR/GDR/CDI Fees](https://www.interactivebrokers.com/en/pricing/other-fees.php). |
| Default behavior is conservative: do not reduce the Polish art. 30a dividend base by ADR/GDR/CDI fees. | Polish PIT art. 30a ust. 1 pkt 4 covers dividends, and art. 30a ust. 6 states that the flat-rate tax for the listed income types is collected without reducing revenue by tax-deductible costs: [PIT Act art. 30a](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/). |
| Foreign dividend tax and foreign tax credit remain in PIT-38 section G. | The Ministry of Finance PIT-38 guidance for 2025 describes foreign art. 30a income, including dividends, and the art. 30a ust. 9 foreign-tax-credit cap: [podatki.gov.pl — PIT-38 za 2025 rok](https://www.podatki.gov.pl/twoj-e-pit/pit-38-za-2025-rok/). |
| An opt-in setting exists because a user may have broker/prospectus/tax-advisor evidence that the fee should be treated as reducing a specific dividend rather than as a separate cost. | IBKR points users to the ADR/GDR/CDI prospectus for fee details, while the Polish sources above do not directly resolve every broker-reporting pattern. The setting keeps this judgment explicit and auditable. |

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

| Function         | Legal basis                                                                         | Algorithm                                                  | Used for                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `roundToFullPln` | [Art. 63 § 1 Ordynacji podatkowej](https://lexlege.pl/ordynacja-podatkowa/art-63/)  | `Math.round(amount)` — mathematical rounding to full złoty | Tax base (poz. 31), capital gains tax due (poz. 35), crypto placeholders (poz. 41/45), monthly placeholder fields |
| `roundToGrosz`   | Form field precision (`zł, gr`)                                                     | `Math.round((amount + EPSILON) × 100) / 100` — nearest grosz | PIT-38 Section C totals/gain/loss (poz. 22/23/26/27/28/29), foreign tax credit (poz. 48), payment summary (poz. 51/52) |
| `roundToGroszUp` | [Art. 63 § 1a Ordynacji podatkowej](https://lexlege.pl/ordynacja-podatkowa/art-63/) | `Math.ceil(amount × 100) / 100` — ceiling to full groszy   | Dividend/interest tax amount (poz. 47), dividend/interest tax difference (poz. 49) |

**`roundToGroszUp` precision handling:** Uses `+(amount * 100).toFixed(10)` before `Math.ceil` to avoid floating-point artifacts (e.g., `0.1 + 0.2 = 0.30000000000000004`).

**PIT-38 Section G precision note:** PIT-38(18) labels `poz. 49` as a difference "po zaokrągleniu do pełnych złotych", while the official e-PIT examples and the form amount cells for `poz. 47-49` and `poz. 51-52` use `zł, gr` precision. kloPIT follows the filing UI precision for copy/paste values: `poz. 47` and `poz. 49` are rounded up to full groszy, `poz. 48` and `poz. 51-52` are rounded to nearest grosz.

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
- PIT-38(18) `poz. 47` is the flat-rate tax from foreign art. 30a ust. 1 pkt 1-5 income. This includes dividends under art. 30a ust. 1 pkt 4 and supported broker credit interest under art. 30a ust. 1 pkt 3.
- PIT-38(18) `poz. 48` is foreign tax paid under art. 30a ust. 9, converted to PLN and capped so it cannot exceed `poz. 47`.
- PIT-38(18) `poz. 49` is the difference `poz. 47 - poz. 48`.
- PIT-38(18) `poz. 51` is `max(poz35 + poz45 + poz46 + poz49 - poz50, 0)`.

```
poz46 = 0                                                        // Other flat-rate tax (not applicable)
poz47 = roundToGroszUp((totalDividendsPln + totalCreditInterestPln) × 0.19)  // Foreign flat-rate tax (19%)
poz48 = round_to_groszy(min(totalDeductibleWithholdingPln + totalCreditInterestForeignTaxPln, poz47))  // Deductible foreign tax
poz49 = roundToGroszUp(max(poz47 − poz48, 0))                   // Dividend tax difference (art. 63 § 1a)
poz50 = 0                                                        // Advance payments by payers
poz51 = roundToGrosz(max(poz35 + poz45 + poz46 + poz49 − poz50, 0))  // TAX TO PAY
poz52 = roundToGrosz(max(poz50 − (poz35 + poz45 + poz46 + poz49), 0))  // OVERPAYMENT
```

Where `round_to_groszy` uses `Math.round(amount × 100) / 100` (standard rounding to nearest grosz).

#### Section J — OPP 1.5% Request

```
poz66 = selected OPP KRS
poz67 = floor((poz35 + supported poz45) × 0.015 × 10) / 10
poz68 = optional specific purpose
poz69 = consent to pass taxpayer details and poz67 amount to the OPP
```

kloPIT does not currently calculate crypto Section F, so supported `poz45` is always 0 and `poz67` is effectively based on `poz35`.

#### Sections H & I — Monthly Flat-Rate Tax (placeholders, all zeros)

Not yet implemented. Fields poz53–poz65 are set to 0.

---

### 9. PIT/ZG Attachment (Per-Country)

**Implementation:** `pit-zg.ts`

**Legal basis:** [Art. 45 ust. 1a ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-45/) and PIT/ZG(8) section C.3 — PIT/ZG is filed per country for income/tax settled in PIT-38 under art. 30b.

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

Foreign dividends are art. 30a flat-rate income and stay in PIT-38 section G by default. They do not create PIT/ZG entries unless the user enables the compatibility setting.

**Optional dividend compatibility setting:**

The `/settings` page exposes **Show dividends in PIT/ZG**, disabled by default. When enabled, PIT/ZG also shows helper dividend rows per country, next to the official PIT-38 section G values. This setting is intentionally narrow and does not replace the official PIT-38 section G dividend calculation.

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
    cap        = expired ? 0 : min(0.5 × loss.totalLossPln,
                                    loss.totalLossPln − loss.alreadyDeductedPln)
    deducted   = min(cap, remainingGain)
    remainingGain −= deducted
    loss.alreadyDeductedPln += deducted  // returned in updatedLosses

poz30 = sum of deducted across all priorLosses
```

**Guarantees:**

- Losses older than 5 years or newer than the tax session are silently skipped (a warning is attached for residuals lost to expiration).
- The 50%-per-year cap is enforced per loss year — a user entering 100% of a loss as "already deducted" previously still has their residual constrained by `0.5 × totalLossPln`.
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
- **Carry-in positions table:** Prior year shares
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
2. **Resolve exchange rates** — For each transaction, fetch the NBP Table A average rate from the last business day before the transaction date. Each trade gets two rates (amount + commission). Each dividend and withholding tax entry gets its own rate.
3. **Capital gains** (`calculateCapitalGains`):
   - Seed carry-in positions into FIFO queues (cost = 0, already claimed)
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
   - Round tax base and tax due to full PLN ([art. 63 § 1](https://lexlege.pl/ordynacja-podatkowa/art-63/))
   - Round dividend and credit interest tax to full groszy up ([art. 63 § 1a](https://lexlege.pl/ordynacja-podatkowa/art-63/))
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
- ✅ PIT/ZG C.3 per-country attachment values for PIT-38 share income
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
- Fill in PIT/ZG attachment rows shown by kloPIT (one per country when share income is present)
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
| Credit interest tax 19%          | Art. 30a ust. 1 pkt 3 ustawy o PIT | [lexlege.pl](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/) |
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
| DTT withholding rates (all countries) | Polish double-tax treaties (UPO) | [PwC Worldwide Tax Summaries — Poland](https://taxsummaries.pwc.com/poland/corporate/withholding-taxes) |

**Full legal texts:**

- [Ustawa o podatku dochodowym od osób fizycznych (PIT)](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/) — Dz.U. 1991 nr 80 poz. 350
- [Ordynacja podatkowa](https://lexlege.pl/ordynacja-podatkowa/) — Dz.U. 1997 nr 137 poz. 926

---

## Glossary

| Term                 | Meaning                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| **Credit Interest** | Interest earned on uninvested cash held at a broker                    |
| **FIFO**             | First In, First Out — method to match sales with purchases                     |
| **NBP**              | Narodowy Bank Polski (Polish National Bank) — provides official exchange rates |
| **PIT-38**           | Polish tax form for capital gains and dividends                                |
| **PIT/ZG**           | Attachment to PIT-38 for foreign income/tax — one per country                  |
| **OPP**              | Optional 1.5% request to transfer part of tax due to a public benefit organization |
| **Withholding Tax**  | Tax deducted by foreign broker (usually 15% US dividends)                      |
| **Carry-In**         | Shares owned from prior tax years                                              |
| **Corporate Action** | Stock split, dividend spin-off, etc.                                           |
| **Session**          | One tax year's workspace (trades + dividends + results)                        |
| **IndexedDB**        | Browser database where your data is stored locally                             |

---

## Verification & Transparency

kloPIT treats the PIT-38 form page as a **summary view** — every number is computed from rows you can inspect on the Dashboard.

**How to audit your numbers:**

- **Capital gains (Sections C + D)** — `/dashboard#trades` shows each closed trade with proceeds (PLN), FIFO-matched cost basis (PLN), gain/loss (PLN), and the 19% tax on that trade. Totals at the bottom of the table tie to `poz. 22` (proceeds), `poz. 23` (costs), `poz. 28` (gain) or `poz. 29` (loss). Prior-year loss deductions feeding `poz. 30` are broken down per-year in Section D.
- **Dividends and credit interest (Section G)** — `/dashboard#dividends` shows each dividend with PLN amount, effective foreign withholding %, the UPO-capped deductible %, and PL tax-to-pay %. Totals correspond to `poz. 47` (19% flat-rate tax), `poz. 48` (deductible foreign tax), and `poz. 49` (tax difference).
- **Rounding** — section C form totals (`poz. 22/23/26/27/28/29`) and payment summary (`poz. 51/52`) are rounded to grosz precision. The base and capital-gains tax due (`poz. 31`, `poz. 35`) are rounded to full PLN (`roundToFullPln`). Dividend and interest tax amounts (`poz. 47`, `poz. 49`) are rounded up to full grosze (`roundToGroszUp`). See `src/core/tax/pit38.ts`, `src/core/tax/rounding.ts`, and `src/core/tax/aggregates.ts`.

**Parser architecture.** Imports run through `ParserDefinition` implementations in `src/core/parsers/` (Interactive Brokers CSV, IBI Capital PDF, manual entry). More brokers are on the roadmap — see `docs/ROADMAP.md`. Parser PRs are welcome.
