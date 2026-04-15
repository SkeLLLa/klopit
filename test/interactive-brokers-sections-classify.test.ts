import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifySection } from '../src/core/parsers/interactive-brokers/sections.js';

void describe('classifySection', () => {
  void it('classifies known supported sections', () => {
    assert.equal(classifySection({ section: 'Statement' }), 'supported');
    assert.equal(classifySection({ section: 'Trades' }), 'supported');
    assert.equal(classifySection({ section: 'Dividends' }), 'supported');
    assert.equal(classifySection({ section: 'Withholding Tax' }), 'supported');
    assert.equal(
      classifySection({ section: 'Corporate Actions' }),
      'supported',
    );
    assert.equal(
      classifySection({ section: 'Financial Instrument Information' }),
      'supported',
    );
    assert.equal(
      classifySection({ section: 'Mark-to-Market Performance Summary' }),
      'supported',
    );
  });

  void it('classifies ignorable sections', () => {
    assert.equal(
      classifySection({ section: 'Account Information' }),
      'ignorable',
    );
    assert.equal(classifySection({ section: 'Net Asset Value' }), 'ignorable');
    assert.equal(classifySection({ section: 'Change in NAV' }), 'ignorable');
    assert.equal(classifySection({ section: 'Cash Report' }), 'ignorable');
    assert.equal(classifySection({ section: 'Open Positions' }), 'ignorable');
    assert.equal(classifySection({ section: 'Codes' }), 'ignorable');
  });

  void it('classifies non-taxable informational sections as ignorable', () => {
    // Cash movements between user bank and IBKR — not a taxable event.
    assert.equal(
      classifySection({ section: 'Deposits & Withdrawals' }),
      'ignorable',
    );
    // End-of-period FX balance snapshot — balance-sheet, no tax event.
    assert.equal(classifySection({ section: 'Forex Balances' }), 'ignorable');
    // Accrued-but-unpaid interest — the taxable event lives in `Interest`.
    assert.equal(
      classifySection({ section: 'Interest Accruals' }),
      'ignorable',
    );
    // IBKR emits notes as a single combined header.
    assert.equal(
      classifySection({ section: 'Notes/Legal Notes' }),
      'ignorable',
    );
    // Per-symbol P/L summary derived from Trades — redundant view.
    assert.equal(
      classifySection({ section: 'Realized & Unrealized Performance Summary' }),
      'ignorable',
    );
    // Statement-level summary row — redundant.
    assert.equal(
      classifySection({ section: 'Total P/L for Statement Period' }),
      'ignorable',
    );
  });

  void it('classifies known unsupported sections', () => {
    assert.equal(classifySection({ section: 'Options' }), 'known-unsupported');
    assert.equal(classifySection({ section: 'Futures' }), 'known-unsupported');
    assert.equal(
      classifySection({ section: 'Forex P/L' }),
      'known-unsupported',
    );
    assert.equal(classifySection({ section: 'Interest' }), 'known-unsupported');
    assert.equal(classifySection({ section: 'Fees' }), 'known-unsupported');
  });

  void it('classifies anything else as unknown', () => {
    assert.equal(classifySection({ section: 'Foobar' }), 'unknown');
    assert.equal(classifySection({ section: '' }), 'unknown');
    assert.equal(classifySection({ section: 'Unknown Section' }), 'unknown');
  });
});
