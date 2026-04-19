export function debounce<A extends readonly unknown[]>(
  fn: (...args: A) => void | Promise<void>,
  waitMs: number,
): ((...args: A) => void) & { cancel: () => void; flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: A | undefined;

  const debounced = ((...args: A) => {
    pending = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (pending) void fn(...pending);
      pending = undefined;
    }, waitMs);
  }) as ((...args: A) => void) & { cancel: () => void; flush: () => void };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  };

  debounced.flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (pending) void fn(...pending);
    pending = undefined;
  };

  return debounced;
}
