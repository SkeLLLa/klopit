import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BrokerId } from '../src/core/types.js';

void describe('core types', () => {
  void it('BrokerId has InteractiveBrokers value', () => {
    assert.equal(BrokerId.InteractiveBrokers, 'ibkr');
  });

  void it('BrokerId has Schwab value', () => {
    assert.equal(BrokerId.Schwab, 'schwab');
  });
});
