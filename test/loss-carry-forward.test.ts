import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyLossCarryForward,
  LOSS_CARRY_FORWARD_YEARS,
  LOSS_PER_YEAR_CAP,
} from '../src/core/tax/loss-carry-forward.js';
import type { PriorYearLoss } from '../src/core/types.js';

function makeLoss(overrides: Partial<PriorYearLoss>): PriorYearLoss {
  return {
    year: 2020,
    totalLossPln: 0,
    alreadyDeductedPln: 0,
    ...overrides,
  };
}

void describe('applyLossCarryForward', () => {
  void it('returns zero deduction when there is no gain', () => {
    const result = applyLossCarryForward({
      gainPln: 0,
      currentYear: 2024,
      priorLosses: [makeLoss({ year: 2022, totalLossPln: 10000 })],
    });

    assert.equal(result.deductedPln, 0);
    assert.equal(result.perYear.length, 1);
    assert.equal(result.perYear[0]?.deductedPln, 0);
    assert.equal(result.updatedLosses[0]?.alreadyDeductedPln, 0);
  });

  void it('returns zero deduction when there are no prior losses', () => {
    const result = applyLossCarryForward({
      gainPln: 5000,
      currentYear: 2024,
      priorLosses: [],
    });

    assert.equal(result.deductedPln, 0);
    assert.deepEqual(result.perYear, []);
    assert.deepEqual(result.updatedLosses, []);
    assert.deepEqual(result.warnings, []);
  });

  void it('caps deduction at 50% of original loss', () => {
    // Single 10 000 PLN loss; user has 8 000 gain → capped at 5 000 (50%).
    const result = applyLossCarryForward({
      gainPln: 8000,
      currentYear: 2024,
      priorLosses: [makeLoss({ year: 2023, totalLossPln: 10000 })],
    });

    assert.equal(result.deductedPln, 5000);
    assert.equal(result.perYear[0]?.capPln, 5000);
    assert.equal(result.perYear[0]?.deductedPln, 5000);
    assert.equal(result.updatedLosses[0]?.alreadyDeductedPln, 5000);
  });

  void it('does not exceed gain even when cap allows more', () => {
    const result = applyLossCarryForward({
      gainPln: 2000,
      currentYear: 2024,
      priorLosses: [makeLoss({ year: 2023, totalLossPln: 10000 })],
    });

    assert.equal(result.deductedPln, 2000);
    assert.equal(result.perYear[0]?.deductedPln, 2000);
    assert.equal(result.updatedLosses[0]?.alreadyDeductedPln, 2000);
  });

  void it('excludes losses older than the carry-forward window and warns', () => {
    // 6-year-old loss: 2024 − 2018 = 6 > 5 → expired.
    const expired = makeLoss({ year: 2018, totalLossPln: 10000 });
    const fresh = makeLoss({ year: 2022, totalLossPln: 10000 });

    const result = applyLossCarryForward({
      gainPln: 50000,
      currentYear: 2024,
      priorLosses: [expired, fresh],
    });

    // Only the fresh loss is usable, capped at 5 000.
    assert.equal(result.deductedPln, 5000);

    // Expired entry is preserved as-is in updatedLosses.
    const expiredOut = result.updatedLosses.find((l) => l.year === 2018);
    assert.ok(expiredOut);
    assert.equal(expiredOut.alreadyDeductedPln, 0);

    const warning = result.warnings.find(
      (w) => w.code === 'expired' && w.year === 2018,
    );
    assert.ok(warning, 'expected expired-loss warning for 2018');
    // The warned amount is the residual that can no longer be deducted.
    assert.equal(warning.amountPln, 10000);
  });

  void it('keeps a loss exactly 5 years old eligible (boundary)', () => {
    // 2024 − 2019 = 5 → still within window.
    const result = applyLossCarryForward({
      gainPln: 50000,
      currentYear: 2024,
      priorLosses: [makeLoss({ year: 2019, totalLossPln: 10000 })],
    });

    assert.equal(result.deductedPln, 5000);
    assert.equal(result.warnings.length, 0);
  });

  void it('tracks residual across consecutive years', () => {
    // Year 1: deduct 5 000 (50% of 10 000)
    const year1 = applyLossCarryForward({
      gainPln: 50000,
      currentYear: 2024,
      priorLosses: [makeLoss({ year: 2023, totalLossPln: 10000 })],
    });
    assert.equal(year1.deductedPln, 5000);
    assert.equal(year1.updatedLosses[0]?.alreadyDeductedPln, 5000);

    // Year 2: deduct another 5 000 (cap = 50% of 10 000, residual = 5 000)
    const year2 = applyLossCarryForward({
      gainPln: 50000,
      currentYear: 2025,
      priorLosses: year1.updatedLosses,
    });
    assert.equal(year2.deductedPln, 5000);
    assert.equal(year2.updatedLosses[0]?.alreadyDeductedPln, 10000);

    // Year 3: nothing left (residual = 0)
    const year3 = applyLossCarryForward({
      gainPln: 50000,
      currentYear: 2026,
      priorLosses: year2.updatedLosses,
    });
    assert.equal(year3.deductedPln, 0);
    assert.equal(year3.perYear[0]?.deductedPln, 0);
  });

  void it('per-year cap is independent across multiple loss years', () => {
    // Two losses: 10 000 (2022) + 6 000 (2023). 50% caps: 5 000 + 3 000 = 8 000.
    const result = applyLossCarryForward({
      gainPln: 100000,
      currentYear: 2024,
      priorLosses: [
        makeLoss({ year: 2022, totalLossPln: 10000 }),
        makeLoss({ year: 2023, totalLossPln: 6000 }),
      ],
    });

    assert.equal(result.deductedPln, 8000);
    const y2022 = result.perYear.find((p) => p.year === 2022);
    const y2023 = result.perYear.find((p) => p.year === 2023);
    assert.equal(y2022?.deductedPln, 5000);
    assert.equal(y2023?.deductedPln, 3000);
  });

  void it('applies oldest losses first (FIFO across years)', () => {
    // Gain only big enough to absorb one full cap: 5 000.
    const result = applyLossCarryForward({
      gainPln: 5000,
      currentYear: 2024,
      priorLosses: [
        makeLoss({ year: 2022, totalLossPln: 10000 }),
        makeLoss({ year: 2023, totalLossPln: 10000 }),
      ],
    });

    assert.equal(result.deductedPln, 5000);
    const y2022 = result.perYear.find((p) => p.year === 2022);
    const y2023 = result.perYear.find((p) => p.year === 2023);
    assert.equal(y2022?.deductedPln, 5000);
    assert.equal(y2023?.deductedPln, 0);
  });

  void it('respects already-deducted amount in cap', () => {
    // 10 000 loss with 4 000 already deducted. Cap = min(50%, residual) =
    // min(5 000, 6 000) = 5 000.
    const result = applyLossCarryForward({
      gainPln: 100000,
      currentYear: 2024,
      priorLosses: [
        makeLoss({
          year: 2023,
          totalLossPln: 10000,
          alreadyDeductedPln: 4000,
        }),
      ],
    });

    assert.equal(result.perYear[0]?.capPln, 5000);
    assert.equal(result.deductedPln, 5000);
    assert.equal(result.updatedLosses[0]?.alreadyDeductedPln, 9000);
  });

  void it('residual can be the binding cap when smaller than 50%', () => {
    // 10 000 loss with 8 000 already deducted. Residual = 2 000 < 5 000.
    const result = applyLossCarryForward({
      gainPln: 100000,
      currentYear: 2024,
      priorLosses: [
        makeLoss({
          year: 2023,
          totalLossPln: 10000,
          alreadyDeductedPln: 8000,
        }),
      ],
    });

    assert.equal(result.perYear[0]?.capPln, 2000);
    assert.equal(result.deductedPln, 2000);
    assert.equal(result.updatedLosses[0]?.alreadyDeductedPln, 10000);
  });

  void it('exposes legal constants', () => {
    assert.equal(LOSS_CARRY_FORWARD_YEARS, 5);
    assert.equal(LOSS_PER_YEAR_CAP, 0.5);
  });
});
