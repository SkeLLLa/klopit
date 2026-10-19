import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  oppAmountPln,
  oppAmountTenGrosze,
  oppTaxDueBase,
} from '../src/core/tax/opp.js';
import type { Pit38Fields } from '../src/core/types.js';

void describe('oppAmountPln (art. 45c updof)', () => {
  void it('180 zł tax due -> 2.70 (float bug gave 2.60)', () => {
    assert.equal(oppAmountPln({ taxDuePln: 180 }), 2.7);
    // Reproduces the old bug for documentation:
    assert.equal(Math.floor(180 * 0.015 * 10) / 10, 2.6);
  });

  void it('rounds down to full 10 groszy', () => {
    assert.equal(oppAmountPln({ taxDuePln: 1234 }), 18.5); // 18.51 -> 18.50
    assert.equal(oppAmountPln({ taxDuePln: 6 }), 0); // 0.09 -> 0.00
    assert.equal(oppAmountPln({ taxDuePln: 7 }), 0.1); // 0.105 -> 0.10
    assert.equal(oppAmountPln({ taxDuePln: 3368 }), 50.5); // 50.52 -> 50.50
  });

  void it('handles zero and negative defensively', () => {
    assert.equal(oppAmountPln({ taxDuePln: 0 }), 0);
    assert.equal(oppAmountPln({ taxDuePln: -10 }), 0);
  });

  void it('exhaustive: matches exact rational result for every whole-PLN tax 0..1_000_000', () => {
    for (let t = 0; t <= 1_000_000; t++) {
      // BigInt as an independent oracle: floor(15*t / 100) tens of grosze
      const oracle = Number((15n * BigInt(t)) / 100n);
      const got = oppAmountTenGrosze({ taxDuePln: t });
      if (got !== oracle) {
        assert.fail(`t=${t}: got ${got}, want ${oracle}`);
      }
      // never exceeds 1.5%: 1.5% of t PLN = 0.15 * t tens of grosze
      if (got * 100 > 15 * t) {
        assert.fail(`t=${t}: ${got} tens of grosze exceeds 1.5%`);
      }
    }
  });

  void it('old formula disagrees for at least one value in range (regression guard)', () => {
    let mismatches = 0;
    for (let t = 0; t <= 100_000; t++) {
      const old = Math.round((Math.floor(t * 0.015 * 10) / 10) * 10);
      if (old !== oppAmountTenGrosze({ taxDuePln: t })) mismatches++;
    }
    assert.ok(mismatches > 0);
  });
});

void describe('oppTaxDueBase', () => {
  void it('sums poz. 35 and poz. 45', () => {
    const f = { 35: 1000, 45: 200 } as Pit38Fields;
    assert.equal(oppTaxDueBase({ pit38: f }), 1200);
  });
});
