import { describe, it, expect, vi } from 'vitest';
import { retryAsync, computeBackoffDelay } from './retry';

/** A sleep stub that records the delays it was asked to wait, but resolves instantly. */
function recordingSleep() {
  const delays: number[] = [];
  const sleep = (ms: number) => { delays.push(ms); return Promise.resolve(); };
  return { delays, sleep };
}

describe('computeBackoffDelay', () => {
  it('returns the base delay for the first attempt and doubles thereafter', () => {
    expect(computeBackoffDelay(1, 400)).toBe(400);
    expect(computeBackoffDelay(2, 400)).toBe(800);
    expect(computeBackoffDelay(3, 400)).toBe(1600);
    expect(computeBackoffDelay(4, 400)).toBe(3200);
  });

  it('caps the delay at maxDelayMs', () => {
    expect(computeBackoffDelay(10, 400, 4000)).toBe(4000);
    expect(computeBackoffDelay(5, 400, 4000)).toBe(4000); // 400*16=6400 -> capped
  });

  it('clamps attempts below 1 to the base delay', () => {
    expect(computeBackoffDelay(0, 400)).toBe(400);
    expect(computeBackoffDelay(-5, 400)).toBe(400);
  });
});

describe('retryAsync', () => {
  it('resolves on the first try without sleeping', async () => {
    const { delays, sleep } = recordingSleep();
    const fn = vi.fn(async () => 'ok');
    const result = await retryAsync(fn, { sleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('retries after failures and resolves once fn succeeds', async () => {
    const { delays, sleep } = recordingSleep();
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error(`fail ${calls}`);
      return 'recovered';
    });
    const result = await retryAsync(fn, { attempts: 3, baseDelayMs: 400, sleep });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
    // Two backoffs before the third (successful) attempt.
    expect(delays).toEqual([400, 800]);
  });

  it('throws the LAST error once attempts are exhausted', async () => {
    const { delays, sleep } = recordingSleep();
    const fn = vi.fn(async (attempt: number) => { throw new Error(`fail ${attempt}`); });
    await expect(retryAsync(fn, { attempts: 3, sleep })).rejects.toThrow('fail 3');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(delays).toHaveLength(2); // slept between the 3 attempts, not after the last
  });

  it('stops immediately when shouldRetry returns false', async () => {
    const { delays, sleep } = recordingSleep();
    const fn = vi.fn(async () => { throw new Error('permanent'); });
    await expect(
      retryAsync(fn, { attempts: 5, sleep, shouldRetry: () => false }),
    ).rejects.toThrow('permanent');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('passes the 1-based attempt number to fn', async () => {
    const { sleep } = recordingSleep();
    const seen: number[] = [];
    const fn = vi.fn(async (attempt: number) => {
      seen.push(attempt);
      if (attempt < 3) throw new Error('again');
      return attempt;
    });
    await retryAsync(fn, { attempts: 3, sleep });
    expect(seen).toEqual([1, 2, 3]);
  });

  it('invokes onRetry before each backoff with the error, attempt and delay', async () => {
    const { sleep } = recordingSleep();
    const onRetry = vi.fn();
    const fn = vi.fn(async (attempt: number) => {
      if (attempt < 3) throw new Error(`err${attempt}`);
      return 'done';
    });
    await retryAsync(fn, { attempts: 3, baseDelayMs: 400, sleep, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1, 400);
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2, 800);
  });

  it('honours a single attempt (no retries)', async () => {
    const { delays, sleep } = recordingSleep();
    const fn = vi.fn(async () => { throw new Error('once'); });
    await expect(retryAsync(fn, { attempts: 1, sleep })).rejects.toThrow('once');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });
});
