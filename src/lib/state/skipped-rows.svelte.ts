import { SvelteMap } from 'svelte/reactivity';
import type { SkippedRow } from '../../core/types.js';

function createSkippedRowsStore() {
  const bySession = new SvelteMap<string, SkippedRow[]>();

  return {
    addSkippedRows(args: { sessionId: string; rows: SkippedRow[] }): void {
      if (args.rows.length === 0) return;
      const current = bySession.get(args.sessionId) ?? [];
      bySession.set(args.sessionId, [...current, ...args.rows]);
    },
    getSkippedRows(args: { sessionId: string }): SkippedRow[] {
      return bySession.get(args.sessionId) ?? [];
    },
    clearSkippedRows(args: { sessionId: string }): void {
      bySession.delete(args.sessionId);
    },
  };
}

export const skippedRowsStore = createSkippedRowsStore();
