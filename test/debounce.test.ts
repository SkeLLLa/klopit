import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { debounce } from '../src/lib/utils/debounce.js';

void describe('debounce', () => {
  void it('calls fn once after rapid bursts', async () => {
    let calls = 0;
    const fn = debounce((n: number) => {
      calls += n;
    }, 20);
    fn(1);
    fn(2);
    fn(3);
    await new Promise<void>((r) => setTimeout(r, 50));
    assert.equal(calls, 3, 'only last invocation should have fired');
  });

  void it('cancel prevents pending call', async () => {
    let calls = 0;
    const fn = debounce(() => {
      calls++;
    }, 20);
    fn();
    fn.cancel();
    await new Promise<void>((r) => setTimeout(r, 50));
    assert.equal(calls, 0);
  });

  void it('flush fires pending call immediately', () => {
    let calls = 0;
    const fn = debounce(() => {
      calls++;
    }, 1000);
    fn();
    fn.flush();
    assert.equal(calls, 1);
  });
});
