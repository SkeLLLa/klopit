import { db, type SessionRecord } from '$lib/db.js';
import { sessionState } from '$lib/state/session.svelte.js';
import { useLiveQuery } from '$lib/utils/live-query.svelte.js';

/**
 * Subscribe to the Dexie sessions table and hydrate `sessionState` on first
 * non-undefined result. Subsequent updates are synced via `setSessions`.
 *
 * Call once per page script block:
 * ```svelte
 * <script lang="ts">
 *   useSessionBootstrap();
 *   const sessions = $derived(sessionState.sessions);
 * </script>
 * ```
 */
export function useSessionBootstrap(): {
  readonly sessions: SessionRecord[];
  readonly activeSessionId: string | undefined;
  readonly activeSession: SessionRecord | undefined;
  readonly initialized: boolean;
} {
  const sessionsQuery = useLiveQuery(() =>
    db.sessions.orderBy('year').reverse().toArray(),
  );
  let initialized = $state(false);

  $effect(() => {
    const list = sessionsQuery.current;
    if (!list) return;
    if (!initialized) {
      sessionState.init(list);
      initialized = true;
    } else {
      sessionState.setSessions(list);
    }
  });

  return {
    get sessions() {
      return sessionState.sessions;
    },
    get activeSessionId() {
      return sessionState.activeSessionId;
    },
    get activeSession() {
      return sessionState.activeSession;
    },
    get initialized() {
      return initialized;
    },
  };
}
