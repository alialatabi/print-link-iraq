/**
 * Small generic async-retry helper used by the checkout submit flow.
 *
 * Customers order on flaky Iraqi mobile networks, so every network op in checkout
 * (file uploads, order/item inserts) is wrapped in `retryAsync` with a short
 * exponential backoff. The only side effect is the injected `sleep`, so the helper
 * is fully unit-testable.
 */

export interface RetryOptions {
  /** Total attempts including the first (default 3). */
  attempts?: number;
  /** Base backoff in ms; the wait before attempt N+1 is base * 2^(N-1) (default 400). */
  baseDelayMs?: number;
  /** Upper bound for a single backoff wait (default 4000). */
  maxDelayMs?: number;
  /** Return false to stop retrying a given error (e.g. a non-transient failure). Default: always retry. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Called right before each backoff wait (for logging/telemetry). */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** Injectable sleep so tests run instantly. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Exponential backoff delay (ms) for a given 1-based attempt number, capped at `maxDelayMs`.
 * Pure — `computeBackoffDelay(1) === baseDelayMs`, then it doubles each attempt.
 */
export function computeBackoffDelay(attempt: number, baseDelayMs = 400, maxDelayMs = 4000): number {
  const safeAttempt = attempt < 1 ? 1 : attempt;
  return Math.min(maxDelayMs, baseDelayMs * 2 ** (safeAttempt - 1));
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn`, retrying on rejection with exponential backoff. Resolves with the first
 * successful result; rejects with the LAST error once attempts are exhausted (or once
 * `shouldRetry` returns false). `fn` receives the 1-based attempt number.
 */
export async function retryAsync<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 400;
  const maxDelayMs = options.maxDelayMs ?? 4000;
  const shouldRetry = options.shouldRetry ?? (() => true);
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt >= attempts;
      if (isLastAttempt || !shouldRetry(error, attempt)) break;
      const delayMs = computeBackoffDelay(attempt, baseDelayMs, maxDelayMs);
      options.onRetry?.(error, attempt, delayMs);
      await sleep(delayMs);
    }
  }
  throw lastError;
}
