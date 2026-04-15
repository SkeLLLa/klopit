import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ImportWarning, SkippedRow } from '../src/core/types.js';
import {
  deriveImportWarnings,
  mergeImportWarnings,
} from '../src/lib/services/import.js';

function skipped(args: {
  section: string;
  kind: SkippedRow['kind'];
  line?: number;
}): SkippedRow {
  return {
    section: args.section,
    kind: args.kind,
    line: args.line ?? 0,
    rawLine: '',
  };
}

void describe('deriveImportWarnings', () => {
  void it('groups skipped rows by (section, kind) and counts them', () => {
    const warnings = deriveImportWarnings({
      skippedRows: [
        skipped({ section: 'Interest', kind: 'known-unsupported' }),
        skipped({ section: 'Interest', kind: 'known-unsupported' }),
        skipped({ section: 'Foobar', kind: 'unknown' }),
      ],
    });

    assert.equal(warnings.length, 2);
    const interest = warnings.find((w) => w.section === 'Interest');
    assert.ok(interest);
    assert.equal(interest.rowCount, 2);
    assert.equal(interest.kind, 'known-unsupported');
  });
});

void describe('mergeImportWarnings', () => {
  void it('merges duplicate (section, kind) entries and sums rowCount', () => {
    const existing: ImportWarning[] = [
      {
        section: 'Interest',
        kind: 'known-unsupported',
        rowCount: 14,
        message: 'Interest: 14 rows skipped (known unsupported section)',
      },
    ];
    const incoming: ImportWarning[] = [
      {
        section: 'Interest',
        kind: 'known-unsupported',
        rowCount: 8,
        message: 'Interest: 8 rows skipped (known unsupported section)',
      },
      {
        section: 'Transaction Fees',
        kind: 'known-unsupported',
        rowCount: 3,
        message: 'Transaction Fees: 3 rows skipped (known unsupported section)',
      },
    ];

    const merged = mergeImportWarnings({
      warnings: [...existing, ...incoming],
    });

    assert.equal(merged.length, 2);
    const interest = merged.find((w) => w.section === 'Interest');
    assert.ok(interest);
    assert.equal(interest.rowCount, 22);
    assert.equal(
      interest.message,
      'Interest: 22 rows skipped (known unsupported section)',
    );
    const fees = merged.find((w) => w.section === 'Transaction Fees');
    assert.ok(fees);
    assert.equal(fees.rowCount, 3);
  });

  void it('preserves distinct (section, kind) combinations', () => {
    const merged = mergeImportWarnings({
      warnings: [
        {
          section: 'Trades',
          kind: 'parse-failure',
          rowCount: 1,
          message: 'Trades: 1 rows failed to parse',
        },
        {
          section: 'Trades',
          kind: 'known-unsupported',
          rowCount: 2,
          message: 'Trades: 2 rows skipped (known unsupported section)',
        },
      ],
    });

    assert.equal(merged.length, 2);
  });

  void it('returns empty list for empty input', () => {
    assert.deepEqual(mergeImportWarnings({ warnings: [] }), []);
  });

  void it('is idempotent for already-merged input', () => {
    const input: ImportWarning[] = [
      {
        section: 'Interest',
        kind: 'known-unsupported',
        rowCount: 14,
        message: 'Interest: 14 rows skipped (known unsupported section)',
      },
    ];
    assert.deepEqual(mergeImportWarnings({ warnings: input }), input);
  });
});
