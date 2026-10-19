import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatAccount, manualAccount } from '../src/lib/utils/account.js';

void describe('formatAccount', () => {
  void it('masks IBKR ids', () => {
    assert.equal(formatAccount('ibkr:U1234567'), 'U***4567');
  });
  void it('leaves short IBKR ids and other brokers readable', () => {
    assert.equal(formatAccount('ibkr:U123'), 'U123');
    assert.equal(formatAccount('ibi:default'), 'default');
    assert.equal(formatAccount('manual:Savings'), 'Savings');
  });
});

void describe('manualAccount', () => {
  void it('trims and rejects empty labels', () => {
    assert.equal(manualAccount('  Savings '), 'manual:Savings');
    assert.equal(manualAccount('   '), undefined);
  });
  void it('reuses an existing account case-insensitively', () => {
    assert.equal(
      manualAccount('savings', ['ibkr:U1', 'manual:Savings']),
      'manual:Savings',
    );
  });
});
