# kloPIT Roadmap & Feature Summary (2026-10-19)

Open and partially done work, organized by priority tier. Finished items are removed; see [CHANGELOG.md](CHANGELOG.md) for what shipped.

**Shipped brokers:** Interactive Brokers (CSV), IBI (PDF: confirmations, ESPP, RSU), Charles Schwab (CSV, equity awards). Manual entry is available for all data types.

---

## P0: High priority issues

| ID       | Feature                     | Brief Description                                                                                                                                                                                                                                 | Status |
| -------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **P0.3** | Warsaw TZ Conversion        | Convert IBKR NY timestamps to Warsaw TZ at parse time. Fixes tax-year assignment and D-1 NBP lookups. `parseDateTime` (`src/core/parsers/shared/csv-utils.ts`) still builds a local-time `Date` from the statement string without any conversion. |        |
| **P0.6** | A6 Schwab parser check      | Verify the Schwab parser against a real export. Blocked on a sample statement. Schwab rows have no ISIN, so their country resolves to `XX` (unknown) until the user maps it in the country table.                                                 |        |
| **P0.7** | Dividend reversal leftovers | Plan 05 follow-ups: reversals that fall on a different date than the original dividend are not netted against it (cross-date reversals), and a withholding row with no matching dividend is dropped silently instead of being surfaced.           |        |

---

## P1: Export & Calculation Quality

Ready-to-file tax outputs and calculation refinements.

| ID       | Feature                 | Brief Description                                                                                                                                                                                                                                       | Status |
| -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **P1.1** | e-Deklaracje XML        | Schema-valid XML for PIT-38(18) + embedded PIT/ZG. Direct download → upload to e-Urząd Skarbowy. Build-time XSD validation.                                                                                                                             |        |
| **P1.2** | PIT/ZG Export           | Printable PIT/ZG(8) cards per country + XML attachment. Verified `poz.` numbering and item 6/7 country display.                                                                                                                                         |        |
| **P1.3** | Loss CF Consistency     | Audit all export formats (UI, PDF, CSV, XML) read from single `TaxSummary` source. No recalculation drift.                                                                                                                                              |        |
| **P1.5** | Foreign tax on gains    | PIT/ZG is required only when the creditable foreign tax on gains is above 0, but no importer records foreign tax on gains (`foreignTaxPln` is always 0), so every gains row is informational today. Add a source (import or manual entry) for that tax. |        |
| **P1.6** | Proportional credit cap | The Polish tax due is split across countries in proportion to their gains, which approximates the art. 30b ust. 5a limit. Refine the per-country cap.                                                                                                   |        |

---

## P3: Quality, Audit & Performance

Integration tests and hardening (IBKR-focused).

| ID       | Feature                  | Brief Description                                                                                                                         | Status  |
| -------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **P3.3** | NBP Error Handling       | Done: HTTP 404 (no table that day) is told apart from network errors. Open: retry on network errors, structured logging per walkback hop. | Partial |
| **P3.4** | E2E Fixture Tests (IBKR) | Parser and calculator tests run on `test/fixtures/ib/*.csv`. Open: CSV → `Pit38Fields` golden-file assertions on every `poz.`.            | Partial |
| **P3.5** | Totals Validation (IBKR) | Compare IBKR parser aggregates against statement totals (±0.02 PLN). Catch layout drift & partial-parse bugs early.                       |         |

---

## Optional: Additional Brokers (Nice-to-Have)

Support for alternative brokers beyond the shipped IBKR, IBI and Schwab parsers. Lower priority.

| ID        | Feature            | Brief Description                                                                                                                 | Status |
| --------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **OPT.1** | Trading 212 Parser | CSV parser for T212. Handle GBX → GBP normalization; route free-shares / cashback with warnings.                                  |        |
| **OPT.2** | DEGIRO Parser      | CSV parser for DEGIRO Account + Transactions exports. Correctly match dividend ↔ withholding rows. T+2 settlement default.        |        |
| **OPT.3** | Revolut Parsers    | PDF parser for stock P&L; CSV parser for crypto. Use browser-compatible WASM PDF extraction. Totals-validation check (±0.02 PLN). |        |
| **OPT.4** | Crypto Sections    | Populate PIT-38 Sekcja E/F (art. 30b ust. 1a). Cash-basis (no FIFO); separate 5-year loss window. Replace the placeholder fields. |        |

---
