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
mise install # pins Node 24 + pnpm via .mise.toml
pnpm install
pnpm dev   # dev server → http://localhost:5173
pnpm test  # lint + unit tests
pnpm build # production build → build/
```

---

## Code & Quality Rules

- **All tests must pass** — run `pnpm test` before opening a PR. PRs with failing tests will not be merged.
- **Type-check** — `pnpm svelte-check` must report 0 errors.
- **Formatting & lint** are automatic: a post-save hook runs Prettier on every edited file. Do not bypass it.
- **Framework-agnostic core** — `src/core/` must remain pure TypeScript with no Svelte imports. Tax logic and parsers live there.
- **Svelte 5 only** — use runes (`$state`, `$derived`, `$effect`). Do not use legacy `$:` reactive statements or Svelte stores.
- **Object arguments** — prefer `function foo(args: { bar: string; baz: number })` over multiple positional parameters.
- **No over-engineering** — add only what is requested or clearly necessary. Avoid adding helpers, error handling, or abstractions for one-time use.

---

## Modifying or Adding Tax Calculations

If you change any tax logic, **you must cite the relevant legal basis** in the PR description and, where practical, in an inline comment. Key references:

| Topic                         | Legal source                                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| FIFO cost basis method        | [Art. 24 ust. 10 ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-24/) |
| Capital gains tax (19%)       | [Art. 30b ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30b/)       |
| Dividend flat-rate tax        | [Art. 30a ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-30a/)       |
| NBP exchange rate rule        | [Art. 11a ustawy o PIT](https://lexlege.pl/ustawa-o-podatku-dochodowym-od-osob-fizycznych/art-11a/)       |
| Rounding of tax amounts       | [Art. 63 § 1a Ordynacji podatkowej](https://lexlege.pl/ordynacja-podatkowa/art-63/)                       |
| PIT-38 form (current edition) | [podatki.gov.pl — PIT-38](https://www.podatki.gov.pl/pit/twoj-e-pit/pit-38-za-2024)                       |
| NBP exchange rates API        | [api.nbp.pl](https://api.nbp.pl/)                                                                         |

> **Important:** kloPIT is not official tax software and does not provide legal or financial advice. Any change to calculation logic must be accompanied by a unit test in `test/` that demonstrates the expected result for a concrete input.

---

## Adding a Broker Parser

The parser system is plugin-based — adding a new broker **does not require changing any existing file** except `src/core/parsers/registry.ts`.

1. Create `src/core/parsers/<broker-id>/index.ts` implementing the `BrokerParser` interface from `src/core/parsers/types.ts`.
2. Register it in `src/core/parsers/registry.ts`.
3. Add at least one test in `test/` covering a realistic parse scenario (anonymise any personal data).
4. Include a sample (anonymised) activity statement in `examples/` if the format is not already present.

---

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
- Run `pnpm test` and `pnpm svelte-check` on the final output; do not submit AI-generated code that has not been validated.
