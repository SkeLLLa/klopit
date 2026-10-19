# Contributing to kloPIT

Thank you for your interest in improving kloPIT! Before opening a PR, please read the guidelines below.

---

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Development Setup](#development-setup)
- [Code & Quality Rules](#code--quality-rules)
- [Modifying or Adding Tax Calculations](#modifying-or-adding-tax-calculations)
- [Adding a Broker Parser](#adding-a-broker-parser)
- [Commit & PR Guidelines](#commit--pr-guidelines)
- [AI-Assisted Contributions](#ai-assisted-contributions)

---

## Ways to Contribute

| Type                | What to do                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Bug in calculations | Open an issue with an anonymised CSV or a minimal test case and the expected vs. actual result     |
| New broker parser   | Open an issue with a sample (anonymised) activity statement, or implement the parser and send a PR |
| UI / UX improvement | Open an issue first to discuss scope before coding                                                 |
| i18n / translations | Edit `messages/en.json`, `pl.json`, `uk.json` — run `pnpm i18n` to regenerate                      |
| Documentation       | PRs welcome — no issue required for small fixes                                                    |

---

## Development Setup

```bash
mise install  # pins Node 26 + pnpm 12 via .mise.toml
pnpm install
pnpm dev      # dev server → http://localhost:5173
mise run certs  # optional: HTTPS for pnpm dev (add a LAN IP as an argument)
pnpm lint     # svelte-check + oxlint + oxfmt --check
pnpm format   # format with oxfmt
pnpm test     # lint + unit tests
pnpm build    # production build → build/
```

### Bumping pinned tool versions

Dependabot covers `npm` and `github-actions` (`.github/dependabot.yml`) but does not support mise (it has no `mise` ecosystem; checked against GitHub's supported-ecosystems list). Node, pnpm and mkcert are pinned in `.mise.toml` and bumped by hand:

```bash
mise upgrade --bump   # rewrite the pins in .mise.toml and refresh mise.lock
```

Keep `engines`/`devEngines` and `packageManager` in `package.json` in step with the pins, then run the full lint/build/test chain. Check `mise outdated` when updating dependencies.

---

## Code & Quality Rules

- **All tests must pass** — run `pnpm test` before opening a PR. PRs with failing tests will not be merged.
- **Type-check** — `pnpm lint:types` (svelte-check) must report 0 errors.
- **TypeScript strictness** — `tsconfig.json` enables `strict`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch` and `noPropertyAccessFromIndexSignature`. With `exactOptionalPropertyTypes`, write optional properties that may receive `undefined` as `foo?: T | undefined`. `noUncheckedIndexedAccess` is deliberately **off**: enabling it produced 649 errors (mostly array/record indexing that is safe by construction), well beyond what is worth annotating. Prefer `.at()`/`Map` and explicit checks in new code, and don't add the flag without a plan to fix those.
- **Type-aware lint gap in `.svelte`** — as of oxlint 1.88.0 / oxlint-tsgolint 7.0.2004 (the latest releases), `oxlint --type-aware` runs only syntactic rules on `<script lang="ts">` blocks in `.svelte` files (e.g. `no-explicit-any` fires); rules that need type information (`no-floating-promises`, `no-unsafe-*`, `restrict-template-expressions`, `no-unnecessary-condition`, …) are silently skipped there. `svelte-check` still catches type errors in `.svelte` scripts and templates, but not those lint rules, so review promises and `any`-flow in `.svelte` files by hand. Move logic that needs those checks into `.ts` modules where possible.
- **Formatting & lint** — run `pnpm format` (oxfmt) before committing; `pnpm lint` (oxlint + `oxfmt --check`) must pass. There are no git hooks, so CI enforces this.
- **Framework-agnostic core** — `src/core/` must remain pure TypeScript with no Svelte imports. Tax logic and parsers live there.
- **Svelte 5 only** — use runes (`$state`, `$derived`, `$effect`). Do not use legacy `$:` reactive statements or Svelte stores.
- **Object arguments** — prefer `function foo(args: { bar: string; baz: number })` over multiple positional parameters.
- **No over-engineering** — add only what is requested or clearly necessary. Avoid adding helpers, error handling, or abstractions for one-time use.

---

## Modifying or Adding Tax Calculations

If you change any tax logic, **you must cite the relevant legal basis** in the PR description and, where practical, in an inline comment. Key references:

| Topic                         | Legal source                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| FIFO cost basis method        | [Art. 24 ust. 10 ustawy o PIT](https://lexlege.pb.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/)                           |
| Capital gains tax (19%)       | [Art. 30b ustawy o PIT](https://lexlege.pb.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30b/)                                 |
| Dividend flat-rate tax        | [Art. 30a ustawy o PIT](https://lexlege.pb.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/)                                 |
| NBP exchange rate rule        | [Art. 11a ustawy o PIT](https://lexlege.pb.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-11a/)                                 |
| Rounding of tax amounts       | [Art. 63 § 1 and § 1a Ordynacji podatkowej](https://lexlege.pb.pl/ordynacja-podatkowa/art-63/) (§ 1a: art. 30a ust. 1 pkt 1–3 only) |
| PIT-38 form (current edition) | [podatki.gov.pl — PIT-38](https://www.podatki.gov.pl/pit/twoj-e-pit/pit-38-za-2024)                                                 |
| NBP exchange rates API        | [api.nbp.pl](https://api.nbp.pl/)                                                                                                   |

> **Important:** kloPIT is not official tax software and does not provide legal or financial advice. Any change to calculation logic must be accompanied by a unit test in `test/` that demonstrates the expected result for a concrete input.

---

## Adding a Broker Parser

The parser system is plugin-based — adding a new broker **does not require changing any existing file** except `src/core/parsers/registry.ts`.

1. Create `src/core/parsers/<broker-id>/index.ts` implementing the `BrokerParser` interface from `src/core/parsers/types.ts`.
2. Register it in `src/core/parsers/registry.ts`.
3. Add at least one test in `test/` covering a realistic parse scenario (anonymise any personal data).
4. Include a sample (anonymised) activity statement in `examples/` if the format is not already present.

---

## Database Schema Upgrades

User input must survive every IndexedDB upgrade (`src/lib/db.ts`):

- An upgrade must **never clear or drop an input table** (sessions, trades, dividends, withholding taxes, carry-in positions, transaction fees, credit interests, corporate actions, prior losses, symbol country overrides).
- An upgrade **may clear derived tables** (trade/dividend/credit-interest results, tax summaries, NBP rate cache). When it does, it must also set the affected sessions to `'draft'` so results are recalculated.
- The table lists live in `src/lib/db-tables.ts` (`INPUT_TABLES`, `DERIVED_TABLES`). Every new table must be classified there, and every version bump must update the lists and `test/db-input-preservation.test.ts`.
- `test/db-input-preservation.test.ts` enforces this: it upgrades from every version v8–v15 to the latest and checks that all input rows survive, plus a realistic v15 → v16 case (accounts, incentive, transfers, override scopes).
- Optional, unindexed fields need no schema change; only add an index when a query needs it. Mark calculated sessions stale (keep `calculatedAt`, set `dataUpdatedAt = new Date()` so `isSessionStale` is true; clearing `calculatedAt` hides the stale banner) when a bump changes calculation results.
- Every version bump must also add a step to `BACKUP_MIGRATIONS` in `src/lib/services/backup.ts` (keyed by the new version; an identity function when row shapes are unchanged), so older backups from v16 onwards stay importable. `test/backup.test.ts` fails when an entry is missing.
- v16 bundles all plan-10 changes (rounding, gross proceeds, incentive regime, ADR/PIL country, accounts, transfers). It also sets `perAccountFifoNoticePending` on existing sessions that mix several brokers or accounts, for a one-time dismissible notice; new sessions never get it.

## Commit & PR Guidelines

- Use **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:` — no emojis, no co-author footers.
- Keep commits focused — one logical change per commit.
- Rebase on `master` before opening a PR; do not merge-commit.
- PR title must follow the same Conventional Commits format.

---

## AI-Assisted Contributions

AI-assisted contributions are welcome and the repository is pre-configured to make them easy.

A `.mcp.json` file is included at the repository root. It configures the [**Svelte MCP server**](https://github.com/sveltejs/mcp) (`@sveltejs/mcp`) which gives AI coding assistants (GitHub Copilot, Claude, Cursor, etc.) up-to-date Svelte 5 documentation and component validation without requiring manual context injection.

**If you use an AI assistant:**

- Verify all generated tax logic against the legal references in the table above — AI can be wrong about specific Polish tax rules.
- Run `pnpm test` (lint + unit tests) on the final output; do not submit AI-generated code that has not been validated.
