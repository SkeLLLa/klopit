# kloPIT

[![CI](https://github.com/SkeLLLa/klopit/actions/workflows/verify.yml/badge.svg)](https://github.com/SkeLLLa/klopit/actions/workflows/verify.yml)
[![CodeQL](https://github.com/SkeLLLa/klopit/actions/workflows/codeql.yml/badge.svg)](https://github.com/SkeLLLa/klopit/actions/workflows/codeql.yml)
[![OSV](https://github.com/SkeLLLa/klopit/actions/workflows/osv.yml/badge.svg)](https://github.com/SkeLLLa/klopit/actions/workflows/osv.yml)
[![Release](https://github.com/SkeLLLa/klopit/actions/workflows/release.yml/badge.svg)](https://github.com/SkeLLLa/klopit/actions/workflows/release.yml)
[![Latest release](https://img.shields.io/github/v/release/SkeLLLa/klopit)](https://github.com/SkeLLLa/klopit/releases/latest)
[![License: AGPL-3.0](https://img.shields.io/github/license/SkeLLLa/klopit)](LICENSE)
[![SvelteKit](https://img.shields.io/badge/svelte-5-orange)](https://svelte.dev)
[![inlang status](https://badge.inlang.com/?url=github.com/SkeLLLa/klopit&project=%2Fproject.inlang)](https://fink.inlang.com/github.com/SkeLLLa/klopit?project=%2Fproject.inlang)

**Polish PIT-38 tax calculator for brokerage income** — runs entirely in your browser, no server, no accounts, no data leaves your machine.

> **The only external call the app makes is to the [NBP public API](https://api.nbp.pl/) to fetch PLN exchange rates.** All other processing — CSV parsing, FIFO calculations, tax math, storage — happens locally in your browser.

**Live app: [klopit.co.pl](https://klopit.co.pl)** | Found a mistake in translations? [Fix it on Fink](https://fink.inlang.com/github.com/SkeLLLa/klopit?project=%2Fproject.inlang) (if Fink will fix all their issues :)

> **kloPIT** — from Ukrainian "клопіт" and Polish "kłopot" (worry, hassle, trouble). Filing taxes is a hassle — this tool handles it for you.

## What It Does

kloPIT automates the most tedious parts of filing **PIT-38** (capital gains & dividends):

1. **Import** — parse your broker's statement (Interactive Brokers CSV, IBI Capital PDF and Charles Schwab CSV (equity awards) ship today; more brokers on the roadmap)
2. **Convert** — fetch NBP exchange rates and convert foreign-currency amounts to PLN automatically; rates are cached locally in IndexedDB
3. **Calculate** — apply the legally-required FIFO method (one queue per broker account, with account transfers) to determine cost basis and compute capital gains
4. **Report** — fill your PIT-38 fields (Sections C, D, G) and PIT/ZG attachment values automatically; handle prior-year loss carry-forwards and optional 1.5% OPP charity donations

## Key Features

- **Privacy by design** — all processing and storage happen in IndexedDB in your browser; nothing is uploaded anywhere
- **FIFO cost basis** — per account, mandated by Polish tax law ([art. 24 ust. 10 ustawy o PIT](https://lexlege.pb.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/))
- **NBP rate lookup** — automatic mid-rate fetch (Table A) for the last business day before each transaction, with an optional estimated T+2 settlement-date mode for trade rates and local caching
- **Dividend withholding credit** — correctly offsets foreign withholding tax (e.g. US 15%) against the 19% Polish rate
- **PIT/ZG attachment** — shows per-country values, required only where foreign tax on capital gains is credited (informational otherwise)
- **Multi-session** — manage multiple tax years independently; edit or delete individual rows after import
- **No backend** — all calculation runs locally; only NBP rates are fetched, and they are cached in IndexedDB after the first fetch (there is no service worker, so the app itself needs a connection to load)
- **Backup & restore** — export all imported data and manual entries to a JSON file from Settings and import it back; calculated results are recomputed after restore
- **RSU / ESPP awareness** — employee-incentive buy lots carry a per-instrument tax regime (qualifying or taxed at acquisition) that feeds the cost basis
- **Content-Security-Policy** — prerendered pages ship a CSP `<meta>` tag (SvelteKit `kit.csp`); outbound requests are limited to the app itself and `api.nbp.pl`
- **Localised UI** — English, Polish, Ukrainian (Paraglide JS compile-time i18n)
- **Full transparency** — Every PIT-38 number on the tax-form page maps to concrete transactions shown on the [Dashboard](https://klopit.co.pl/dashboard): per-trade proceeds / cost / gain / 19% tax, per-dividend effective withholding / treaty-capped deduction / PL tax-to-pay, and per-year loss-carry-forward breakdown under `poz. 30`.
- **W-8BEN & US dividend awareness** — Warns per-dividend when foreign withholding exceeds the Poland–US treaty rate (15%). See the [W-8BEN doc](https://klopit.co.pl/docs/ibkr/w8ben) for how to file or renew the form in IBKR.
- **Plugin parser architecture, more brokers coming** — Interactive Brokers (CSV), IBI Capital (PDF), Charles Schwab (CSV, equity awards), and manual entry ship today. The parser API lives in `src/core/parsers/types.ts` (`ParserDefinition`) — more brokers are on the roadmap, and community PRs are welcome.

## Tech Stack

| Layer           | Technology                                                         |
| --------------- | ------------------------------------------------------------------ |
| Framework       | SvelteKit 3 + Svelte 5 (runes)                                     |
| Language        | TypeScript (`strict` + `exactOptionalPropertyTypes`)               |
| Build           | Vite 8 + Rolldown (oxc transform and minify), adapter-static (SSG) |
| Styling         | Tailwind CSS 4                                                     |
| Charts          | Unovis                                                             |
| PDF parsing     | unpdf                                                              |
| Storage         | IndexedDB via Dexie                                                |
| i18n            | Paraglide JS                                                       |
| Tests           | Node.js `node:test` + `assert/strict`                              |
| Lint            | oxlint (type-aware via oxlint-tsgolint), svelte-check              |
| Format          | oxfmt                                                              |
| TS runner       | @oxc-node/core (`node --import @oxc-node/core/register`)           |
| Package manager | pnpm 12                                                            |

The `src/lib` alias is `#lib` (package `imports`), not `$lib`.

The `src/core/` directory is framework-agnostic pure TypeScript — tax logic, parsers, and NBP fetcher have no Svelte dependency and can be used independently.

## Getting Started

The project uses [mise](https://mise.jdx.dev/) to pin the exact Node.js and pnpm versions declared in [.mise.toml](.mise.toml). Install mise first if you don't have it, then let it set up the runtime:

```bash
mise install # installs Node 26 + pnpm 12 declared in .mise.toml
```

Then install dependencies and start developing:

```bash
pnpm install
pnpm dev   # dev server at http://localhost:5173
pnpm test  # lint + unit tests
pnpm build # production build → build/
```

## Documentation

| Document                                               | Description                                                                                                                            |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md)           | End-to-end walkthrough of the import → convert → calculate → report flow, including exact algorithms (FIFO, NBP rates, rounding rules) |
| [docs/PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md) | Directory map and feature-to-file reference                                                                                            |
| [docs/DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md)   | Rationale behind key architectural choices (browser-only storage, FIFO, explicit broker selection, rate caching)                       |
| [docs/ROADMAP.md](docs/ROADMAP.md)                     | Planned features by priority tier                                                                                                      |
| [docs/CHANGELOG.md](docs/CHANGELOG.md)                 | Release history                                                                                                                        |

## Adding a Broker Parser

The parser system is plugin-based. Each broker is a separate directory under `src/core/parsers/` exporting a `ParserDefinition` (`CsvParserDefinition` or `PdfParserDefinition`, from `src/core/parsers/types.ts`). To add one, add the definition to `ALL_PARSERS` in `src/core/parsers/index.ts` and its id to `BrokerId` in `src/core/types.ts`; the import UI picks it up via `supportedBrokers()`, and `test/registry.test.ts` needs updating.

See [docs/PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md) for the full directory map and [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) for algorithm details.

## Contributing

Bug reports and pull requests are welcome at [github.com/SkeLLLa/klopit](https://github.com/SkeLLLa/klopit).

- **Found a calculation error?** Open an issue — attach your anonymised CSV or a minimal reproduction and describe the expected vs. actual result
- **Using a broker not yet supported?** Open an issue with a sample (anonymised) activity statement, or implement the parser and send a PR
- **Found a mistake in translations?** Fix it directly on [Fink](https://fink.inlang.com/github.com/SkeLLLa/klopit?project=%2Fproject.inlang) — no coding required
- **Have a feature idea?** Check existing issues first, then open a new one describing the use case

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines, legal references for tax logic changes, and notes on AI-assisted contributions.

## License

[AGPL-3.0-only](LICENSE). Additional notices are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
