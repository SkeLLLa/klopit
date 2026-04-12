# kloPIT

**Polish PIT-38 tax calculator for brokerage income** — runs entirely in your browser, no server, no accounts, no data leaves your machine.

> **The only external call the app makes is to the [NBP public API](https://api.nbp.pl/) to fetch PLN exchange rates.** All other processing — CSV parsing, FIFO calculations, tax math, storage — happens locally in your browser.

**Live app: [klopit.co.pl](https://klopit.co.pl)**

> **kloPIT** — from Ukrainian "клопіт" and Polish "kłopot" (worry, hassle, trouble). Filing taxes is a hassle — this tool handles it for you.

## What It Does

kloPIT automates the most tedious parts of filing **PIT-38** (capital gains & dividends):

1. **Import** — parse your broker's CSV activity statement (Interactive Brokers supported; plugin architecture makes adding others straightforward)
2. **Convert** — fetch NBP exchange rates and convert foreign-currency amounts to PLN automatically; rates are cached locally
3. **Calculate** — apply the legally-required FIFO method to determine cost basis and compute capital gains
4. **Report** — fill your PIT-38 fields (Sections C, D, G) and PIT/ZG attachment values automatically; handle prior-year loss carry-forwards and optional 1.5% OPP charity donations

## Key Features

- **Privacy by design** — all processing and storage happen in IndexedDB in your browser; nothing is uploaded anywhere
- **FIFO cost basis** — mandated by Polish tax law ([art. 24 ust. 10 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/))
- **NBP rate lookup** — automatic mid-rate fetch (Table A) for the last business day before each transaction, with local caching
- **Dividend withholding credit** — correctly offsets foreign withholding tax (e.g. US 15%) against the 19% Polish rate
- **PIT/ZG attachment** — shows per-country values required alongside PIT-38 for foreign-source income
- **Multi-session** — manage multiple tax years independently; edit or delete individual rows after import
- **Offline-capable** — works without an internet connection once rates are cached
- **Localised UI** — English, Polish, Ukrainian (Paraglide JS compile-time i18n)

## Tech Stack

| Layer           | Technology                            |
| --------------- | ------------------------------------- |
| Framework       | SvelteKit + Svelte 5 (runes)          |
| Language        | TypeScript (strict)                   |
| Build           | Vite 8, adapter-static (SSG)          |
| Storage         | IndexedDB via Dexie                   |
| i18n            | Paraglide JS                          |
| Tests           | Node.js `node:test` + `assert/strict` |
| Package manager | pnpm                                  |

The `src/core/` directory is framework-agnostic pure TypeScript — tax logic, parsers, and NBP fetcher have no Svelte dependency and can be used independently.

## Getting Started

The project uses [mise](https://mise.jdx.dev/) to pin the exact Node.js and pnpm versions declared in [.mise.toml](.mise.toml). Install mise first if you don't have it, then let it set up the runtime:

```bash
mise install # installs Node 24 + pnpm declared in .mise.toml
```

Then install dependencies and start developing:

```bash
pnpm install
pnpm dev   # dev server at http://localhost:5173
pnpm test  # run all tests
pnpm build # production build → build/
```

## Documentation

| Document                                               | Description                                                                                                                            |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md)           | End-to-end walkthrough of the import → convert → calculate → report flow, including exact algorithms (FIFO, NBP rates, rounding rules) |
| [docs/PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md) | Directory map and feature-to-file reference                                                                                            |
| [docs/DESIGN-DECISIONS.md](docs/DESIGN-DECISIONS.md)   | Rationale behind key architectural choices (browser-only storage, FIFO, explicit broker selection, rate caching)                       |

## Adding a Broker Parser

The parser system is plugin-based. Each broker is a separate module implementing the `BrokerParser` interface from `src/core/parsers/types.ts` and registered in `src/core/parsers/registry.ts`. Adding a new broker does not require changing existing code.

See [docs/PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md) for the full directory map and [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) for algorithm details.

## Credits

kloPIT was heavily inspired by [**Pitly**](https://github.com/volodymyr-kovtun/Pitly) — a PIT-38 calculator with a .NET backend by [Volodymyr Kovtun](https://github.com/volodymyr-kovtun). The sample broker activity statements bundled in `examples/` were extracted from that repository.

## Contributing

Bug reports and pull requests are welcome at [github.com/SkeLLLa/klopit](https://github.com/SkeLLLa/klopit).

- **Found a calculation error?** Open an issue — attach your anonymised CSV or a minimal reproduction and describe the expected vs. actual result
- **Using a broker not yet supported?** Open an issue with a sample (anonymised) activity statement, or implement the parser and send a PR
- **Have a feature idea?** Check existing issues first, then open a new one describing the use case

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines, legal references for tax logic changes, and notes on AI-assisted contributions.

## License

[AGPL-3.0-only](LICENSE)
