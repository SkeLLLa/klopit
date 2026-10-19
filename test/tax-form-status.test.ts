import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  copyBlockReason,
  isTaxFormIncomplete,
} from '../src/lib/utils/tax-form-status.js';

void describe('isTaxFormIncomplete', () => {
  void it('is false without a summary or with zero counts', () => {
    assert.equal(isTaxFormIncomplete(undefined), false);
    assert.equal(isTaxFormIncomplete({}), false);
    assert.equal(isTaxFormIncomplete({ unassignedOverlapCount: 0 }), false);
  });

  void it('is true for each draft reason', () => {
    for (const key of [
      'missingRateCount',
      'missingCostCount',
      'inconsistentCarryInCount',
      'unassignedOverlapCount',
    ] as const) {
      assert.equal(isTaxFormIncomplete({ [key]: 1 }), true, key);
    }
  });
});

void describe('copyBlockReason', () => {
  void it('is null when neither stale nor incomplete', () => {
    assert.equal(copyBlockReason({ stale: false, incomplete: false }), null);
  });

  void it('reports incomplete results', () => {
    assert.equal(
      copyBlockReason({ stale: false, incomplete: true }),
      'incomplete',
    );
  });

  void it('reports a stale session', () => {
    assert.equal(copyBlockReason({ stale: true, incomplete: false }), 'stale');
  });

  void it('lets stale win over incomplete', () => {
    assert.equal(copyBlockReason({ stale: true, incomplete: true }), 'stale');
  });
});
