import type { PriorYearLoss } from '../types.js';

/** Maximum number of tax years a loss can be carried forward (art. 9 ust. 3 updof). */
export const LOSS_CARRY_FORWARD_YEARS = 5;

/** Maximum share of the original loss that can be deducted in any single year. */
export const LOSS_PER_YEAR_CAP = 0.5;

/** Reason a `PriorYearLoss` entry was skipped or limited during deduction. */
export type LossWarningCode = 'expired' | 'fully-deducted';

export interface LossWarning {
  code: LossWarningCode;
  year: number;
  /** Loss amount that could no longer be used (PLN). */
  amountPln: number;
}

export interface LossDeductionEntry {
  /** Year in which the original loss was incurred. */
  year: number;
  /** Original loss amount (PLN). */
  totalLossPln: number;
  /** Already-deducted amount before this calculation (PLN). */
  previouslyDeductedPln: number;
  /**
   * Maximum that could be deducted this year given the 50% cap and
   * residual remaining after previous deductions.
   */
  capPln: number;
  /** Amount actually deducted this year (PLN). */
  deductedPln: number;
}

export interface ApplyLossCarryForwardArgs {
  /** Current-year capital gain to offset (PLN). Must be ≥ 0. */
  gainPln: number;
  /** All prior-year losses on file (any year). */
  priorLosses: PriorYearLoss[];
  /** The tax year in which the gain was realized. */
  currentYear: number;
}

export interface ApplyLossCarryForwardResult {
  /** Total deduction applied to `gainPln` (PLN). Always ≤ gainPln. */
  deductedPln: number;
  /** Per-loss-year breakdown, ordered oldest first. */
  perYear: LossDeductionEntry[];
  /**
   * Updated `priorLosses` with `alreadyDeductedPln` advanced for entries
   * deducted this year. Same length and order as the input. Expired entries
   * are returned unchanged.
   */
  updatedLosses: PriorYearLoss[];
  /** Non-fatal notes (expired losses, exhausted residuals, etc.). */
  warnings: LossWarning[];
}

/**
 * Apply prior-year losses against the current year's capital gain following
 * art. 9 ust. 3 updof:
 *
 *   "O wysokość straty ze źródła przychodów, poniesionej w roku podatkowym,
 *    można obniżyć dochód z tego źródła w najbliższych kolejno po sobie
 *    następujących pięciu latach podatkowych, z tym że wysokość obniżenia
 *    w którymkolwiek z tych lat nie może przekroczyć 50% kwoty tej straty."
 *
 * Rules:
 * 1. A loss from year Y is deductible only in years Y+1 through Y+5.
 * 2. In any single year, at most 50% of the original loss may be deducted.
 * 3. The residual after prior deductions further constrains the cap.
 * 4. Older losses are applied first (FIFO across years), so soon-to-expire
 *    capacity is consumed before newer losses.
 */
export function applyLossCarryForward(
  args: ApplyLossCarryForwardArgs,
): ApplyLossCarryForwardResult {
  const { gainPln, currentYear } = args;

  // Stable order: oldest losses first, but keep input order for output mapping.
  const inputOrder = args.priorLosses.map((loss, index) => ({ loss, index }));
  const sorted = [...inputOrder].sort((a, b) => a.loss.year - b.loss.year);

  const updated: PriorYearLoss[] = args.priorLosses.map((l) => ({ ...l }));
  const perYearByIndex = new Map<number, LossDeductionEntry>();
  const warnings: LossWarning[] = [];

  let remainingGain = Math.max(gainPln, 0);

  for (const { loss, index } of sorted) {
    const ageInYears = currentYear - loss.year;
    const expired = ageInYears > LOSS_CARRY_FORWARD_YEARS || ageInYears <= 0;

    const perYearCap = loss.totalLossPln * LOSS_PER_YEAR_CAP;
    const residual = Math.max(loss.totalLossPln - loss.alreadyDeductedPln, 0);
    const cap = expired ? 0 : Math.max(Math.min(perYearCap, residual), 0);
    const deducted = Math.min(cap, remainingGain);

    perYearByIndex.set(index, {
      year: loss.year,
      totalLossPln: loss.totalLossPln,
      previouslyDeductedPln: loss.alreadyDeductedPln,
      capPln: cap,
      deductedPln: deducted,
    });

    if (expired && residual > 0) {
      warnings.push({
        code: 'expired',
        year: loss.year,
        amountPln: residual,
      });
    } else if (!expired && residual === 0) {
      warnings.push({
        code: 'fully-deducted',
        year: loss.year,
        amountPln: 0,
      });
    }

    if (deducted > 0) {
      updated[index] = {
        ...loss,
        alreadyDeductedPln: loss.alreadyDeductedPln + deducted,
      };
      remainingGain -= deducted;
    }
  }

  // Emit perYear in oldest-first order.
  const perYear = sorted
    .map((s) => perYearByIndex.get(s.index))
    .filter((entry): entry is LossDeductionEntry => entry !== undefined);

  const deductedPln = perYear.reduce((sum, e) => sum + e.deductedPln, 0);

  return {
    deductedPln,
    perYear,
    updatedLosses: updated,
    warnings,
  };
}
