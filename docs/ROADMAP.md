# kloPIT Roadmap & Feature Summary (2026-04-13)

Complete list of planned features, organized by priority tier.

---

## P0: High priority issues

| ID       | Feature                 | Brief Description                                                                                                                                  | Status |
| -------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **P0.1** | Loss Carry-Forward      | 5-year loss deduction window with 50%-per-year cap (art. 9 ust. 3 updof). Replace single-number input with tracked list. UI: `/prior-losses` CRUD. | ✅     |
| **P0.2** | W-8BEN Lapse Warnings   | Warn per-dividend when broker withheld rate exceeds treaty rate (e.g. 30% vs. 15% for USA). Surface non-recoverable excess.                        | ✅     |
| **P0.3** | Warsaw TZ Conversion    | Convert IBKR NY timestamps to Warsaw TZ at parse time. Fixes tax-year assignment and D-1 NBP lookups.                                              |        |
| **P0.4** | Settlement-Date D-1 NBP | Use settlement date (T+0/1/2 offset) instead of trade date for rate lookups. Aligns with art. 17 ust. 1ab updof. UI toggle on `/settings`.         |        |
| **P0.5** | Fail-Loud IBKR Sections | Enumerate all IBKR statement sections; warn on unsupported (Options, Futures) or unknown. Prevent silent under-reporting.                          |        |

---

## P1: Export & Calculation Quality

Ready-to-file tax outputs and performance optimizations.

| ID       | Feature             | Brief Description                                                                                                                | Status |
| -------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **P1.1** | e-Deklaracje XML    | Schema-valid XML for PIT-38(18) + embedded PIT/ZG. Direct download → upload to e-Urząd Skarbowy. Build-time XSD validation.      |        |
| **P1.2** | PIT/ZG Export       | Printable PIT/ZG(8) cards per country + XML attachment. Verified `poz.` numbering and item 6/7 country display.                  |        |
| **P1.3** | Loss CF Consistency | Audit all export formats (UI, PDF, CSV, XML) read from single `TaxSummary` source. No recalculation drift.                       |        |
| **P1.4** | NBP Prefetch        | Fetch full tax-year rates in ≤4 calls per currency (93-day chunks). Consistency: all enriched records see same session snapshot. |        |

---

## P2: IBKR Extended Features & Audit

Income categories and audit extensions for Interactive Brokers (primary broker).

| ID       | Feature         | Brief Description                                                                                                                     | Status |
| -------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **P2.1** | Interest Income | Tax brokerage credit interest at 19% flat (art. 30a ust. 1 pkt 3). Combine with PIT-38 Section G dividend values.                     | ✅     |

---

## P3: Quality, Audit & Performance

Data persistence, integration tests, hardening (IBKR-focused).

| ID       | Feature                  | Brief Description                                                                                                   | Status |
| -------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------ |
| **P3.1** | NBP Cache (IndexedDB)    | Persist fetched NBP rates in Dexie. Enables offline re-calculation. Reduces repeat HTTP calls.                      |        |
| **P3.3** | NBP Error Handling       | Distinguish HTTP 404 (walk back) from network error (retry). Structured logging per walkback hop.                   |        |
| **P3.4** | E2E Fixture Tests (IBKR) | IBKR integration tests (CSV → Pit38Fields). Golden-file assertions on every `poz.`. Highest ROI regression catch.   |        |
| **P3.5** | Totals Validation (IBKR) | Compare IBKR parser aggregates against statement totals (±0.02 PLN). Catch layout drift & partial-parse bugs early. |        |

---

## Optional: Additional Brokers (Nice-to-Have)

Support for alternative brokers. Lower priority; add after IBKR features are solid.

| ID        | Feature            | Brief Description                                                                                                                 | Status |
| --------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **OPT.1** | Trading 212 Parser | CSV parser for T212. Handle GBX → GBP normalization; route free-shares / cashback with warnings.                                  |        |
| **OPT.2** | DEGIRO Parser      | CSV parser for DEGIRO Account + Transactions exports. Correctly match dividend ↔ withholding rows. T+2 settlement default.        |        |
| **OPT.3** | Revolut Parsers    | PDF parser for stock P&L; CSV parser for crypto. Use browser-compatible WASM PDF extraction. Totals-validation check (±0.02 PLN). |        |
| **OPT.4** | Crypto Sections    | Populate PIT-38 Sekcja E/F (art. 30b ust. 1a). Cash-basis (no FIFO); separate 5-year loss window. Upgrade placeholder logic.      |        |

---
