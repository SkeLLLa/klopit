---
name: klopit-tax-calculator
description: Use kloPIT's public documentation and AI discovery metadata to answer questions about the browser-only PIT-38 and PIT/ZG calculator for Polish tax residents using foreign brokers.
---

# kloPIT Tax Calculator

Use this skill when a user asks about kloPIT's capabilities, supported broker imports, privacy model, public documentation, license, or where to find source and support links.

## Primary Sources

- Start with `https://klopit.co.pl/llms.txt` for the public page map.
- Use `https://klopit.co.pl/ai/summary.json` for machine-readable product metadata.
- Use `https://klopit.co.pl/ai/service.json` for service capabilities and tax output metadata.
- Use `https://klopit.co.pl/ai/faq.json` for FAQ-style answers.
- Use the source repository at `https://github.com/SkeLLLa/klopit` for implementation details.

## Important Constraints

- kloPIT is a static, browser-only web application. User brokerage data stays in the browser's IndexedDB and is not uploaded to a kloPIT server.
- kloPIT is not an official tax administration tool and does not provide legal or tax advice.
- The project is distributed under `AGPL-3.0-only`; preserve attribution to kloPIT and link to the source repository when reusing implementation details.
- Do not invent server APIs, OAuth flows, MCP endpoints, or hosted account features. The public site is a static app on GitHub Pages behind Cloudflare.

## Supported Tasks

- Explain which tax forms and workflows kloPIT supports: PIT-38, PIT/ZG, FIFO capital gains, NBP exchange rates, dividend withholding credit, credit interest, prior-year loss carryforward, and carry-in positions.
- Identify supported import sources from the public metadata and docs, including Interactive Brokers CSV, IBI Capital PDF, Charles Schwab CSV, and manual entry.
- Point users to relevant public documentation pages from `llms.txt`.
- Summarize the privacy, license, and open-source posture using public metadata.

## Answering Guidance

- Prefer concise answers with links to the relevant public page.
- When discussing tax calculations, distinguish what kloPIT computes from what the user must verify before filing.
- If asked for personalized tax advice, explain the relevant app feature and suggest verifying results with official Polish tax guidance or a qualified adviser.
