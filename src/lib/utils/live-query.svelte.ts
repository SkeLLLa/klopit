import { liveQuery, type Observable } from 'dexie';

/** Bridge Dexie liveQuery to Svelte 5 reactivity. */
export function useLiveQuery<T>(querier: () => T | Promise<T>): {
  readonly current: T | undefined;
} {
  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
  let data: T | undefined = $state(undefined);

  $effect(() => {
    // Call querier synchronously so Svelte tracks any reactive reads
    // (e.g. $derived sessionId) that happen before the first await.
    // This ensures the effect re-runs when those dependencies change.
    void querier();

    const observable: Observable<T> = liveQuery(querier);
    const subscription = observable.subscribe({
      next: (value) => {
        data = value;
      },
      error: (err) => {
        console.error('liveQuery error:', err);
      },
    });
    return () => {
      subscription.unsubscribe();
    };
  });

  return {
    get current() {
      return data;
    },
  };
}
