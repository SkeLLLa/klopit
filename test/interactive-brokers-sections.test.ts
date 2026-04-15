import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { interactiveBrokersDefinition } from '../src/core/parsers/interactive-brokers.js';

const fixturesDir = join(import.meta.dirname, 'fixtures', 'ib');

function parseFixture(filename: string) {
  const text = readFileSync(join(fixturesDir, filename), 'utf-8');
  const parser = interactiveBrokersDefinition.createParser();
  for (const line of text.split('\n')) {
    parser.feed({ line });
  }
  return parser.finish();
}

void describe('InteractiveBrokersParser skipped-row handling', () => {
  void it('captures known unsupported sections', () => {
    const result = parseFixture('sections-options.csv');
    assert.equal(result.skippedRows.length, 1);
    assert.equal(result.skippedRows[0]?.section, 'Options');
    assert.equal(result.skippedRows[0]?.kind, 'known-unsupported');
  });

  void it('captures unknown sections', () => {
    const result = parseFixture('sections-unknown.csv');
    assert.equal(result.skippedRows.length, 1);
    assert.equal(result.skippedRows[0]?.section, 'Foobar');
    assert.equal(result.skippedRows[0]?.kind, 'unknown');
  });

  void it('keeps ignorable sections silent', () => {
    const result = parseFixture('full-statement.csv');
    assert.equal(
      result.skippedRows.filter((row) => row.section === 'Account Information')
        .length,
      0,
    );
  });

  void it('tags supported-section parse failures', () => {
    const result = parseFixture('sections-parse-failure.csv');
    const parseFailures = result.skippedRows.filter(
      (row) => row.kind === 'parse-failure',
    );

    assert.equal(parseFailures.length, 2);
    assert.equal(parseFailures[0]?.section, 'Trades');
    assert.ok(parseFailures[0]?.rawLine.includes('bad-date'));
  });

  void it('categorizes mixed statements and extracts best-effort fields', () => {
    const result = parseFixture('sections-mixed.csv');

    assert.equal(result.trades.length, 1);
    assert.equal(result.skippedRows.length, 4);

    const optionsRow = result.skippedRows.find(
      (row) => row.section === 'Options',
    );
    assert.equal(optionsRow?.kind, 'known-unsupported');
    assert.equal(optionsRow.currency, 'USD');
    assert.equal(optionsRow.symbol, 'AAPL  240621C00190000');

    const interestRow = result.skippedRows.find(
      (row) => row.section === 'Interest',
    );
    assert.equal(interestRow?.kind, 'known-unsupported');

    const unknownRow = result.skippedRows.find(
      (row) => row.section === 'Foobar',
    );
    assert.equal(unknownRow?.kind, 'unknown');
    assert.equal(unknownRow.datetime, '2024-08-01');

    const parseFailure = result.skippedRows.find(
      (row) => row.kind === 'parse-failure',
    );
    assert.equal(parseFailure?.section, 'Trades');
  });

  void it('does not report design-intent filtering as skipped rows', () => {
    const result = parseFixture('sections-mixed.csv');
    assert.equal(
      result.skippedRows.filter(
        (row) => row.section === 'Trades' && row.rawLine.includes('CFD'),
      ).length,
      0,
    );
  });

  void it('does not report Total/summary rows in known-unsupported or unknown sections', () => {
    const result = parseFixture('sections-totals.csv');

    // Interest section: 2 real entries + 3 Total-summary rows → only the 2
    // real rows should be counted as skipped.
    const interestSkipped = result.skippedRows.filter(
      (row) => row.section === 'Interest',
    );
    assert.equal(
      interestSkipped.length,
      2,
      `expected 2 Interest rows, got ${String(interestSkipped.length)}: ` +
        interestSkipped.map((row) => row.rawLine).join(' | '),
    );

    // Foobar unknown section: 1 real entry + 2 Total-summary rows.
    const foobarSkipped = result.skippedRows.filter(
      (row) => row.section === 'Foobar',
    );
    assert.equal(foobarSkipped.length, 1);
  });
});
