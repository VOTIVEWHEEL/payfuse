import type { PayFuseError } from '@payfuse/core';

/**
 * @package @payfuse/sdk
 * @description Retry manager with exponential backoff and jitter.
 *
 * Only retries operations that fail with a `retryable` severity error.
 * Fatal errors are thrown immediately without retry.
 *
 * Backoff formula:
 * delay = min(baseDelayMs * 2^attempt, maxDelayMs) + random jitter
 *
 * Jitter prevents thundering herd when multiple providers
 * fail simultaneously and retry at the same time.
 */

export interface RetryConfig {
  /** Maximum number of retry attempts. Default: 2 */
  maxRetries?: number;
  /** Base delay in ms before first retry. Default: 500 */
  baseDelayMs?: number;
  /** Maximum delay cap in ms. Default: 10_000 */
  maxDelayMs?: number;
}

/**
 * Type guard — checks if a thrown value is a PayFuseError.
 */
function isPayFuseError(error: unknown): error is PayFuseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'severity' in error
  );
}

/**
 * Computes the delay for a given retry attempt using
 * exponential backoff with full jitter.
 */
function computeDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelayMs);
  // Full jitter: random value between 0 and capped delay
  return Math.random() * capped;
}

/**
 * Pauses execution for `ms` milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes `operation` with automatic retry on retryable failures.
 *
 * @param operation - Async function to execute and retry
 * @param config - Retry configuration
 * @returns Result of the operation on success
 * @throws The last error if all retries are exhausted,
 *         or immediately if the error is fatal
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const maxRetries = config.maxRetries ?? 2;
  const baseDelayMs = config.baseDelayMs ?? 500;
  const maxDelayMs = config.maxDelayMs ?? 10_000;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      // Fatal errors must not be retried
      if (isPayFuseError(error) && error.severity === 'fatal') {
        throw error;
      }

      // No more retries left
      if (attempt === maxRetries) {
        break;
      }

      const delay = computeDelay(attempt, baseDelayMs, maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError;
}
