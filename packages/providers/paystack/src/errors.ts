import type { PayFuseError } from '@payfuse/core';

/**
 * @package @payfuse/paystack
 * @description Structured error factory for the Paystack adapter.
 * All errors thrown by this adapter must be created through
 * these factories — never throw raw Error objects.
 */

/**
 * Creates a retryable PayFuse error — safe to attempt again.
 */
export function createRetryableError(
  code: string,
  message: string,
  cause?: unknown
): PayFuseError {
  return {
    code,
    message,
    provider: 'paystack',
    severity: 'retryable',
    cause,
  };
}

/**
 * Creates a fatal PayFuse error — must not be retried.
 */
export function createFatalError(
  code: string,
  message: string,
  cause?: unknown
): PayFuseError {
  return {
    code,
    message,
    provider: 'paystack',
    severity: 'fatal',
    cause,
  };
}

/** Pre-defined Paystack error factories for common failure scenarios */
export const PaystackErrors = {
  invalidCredentials: (cause?: unknown) =>
    createFatalError(
      'PAYSTACK_INVALID_CREDENTIALS',
      'Paystack secret key is missing or malformed.',
      cause
    ),

  initializeFailed: (message: string, cause?: unknown) =>
    createRetryableError(
      'PAYSTACK_INITIALIZE_FAILED',
      `Paystack charge initialization failed: ${message}`,
      cause
    ),

  verifyFailed: (reference: string, cause?: unknown) =>
    createRetryableError(
      'PAYSTACK_VERIFY_FAILED',
      `Paystack verification failed for reference: ${reference}`,
      cause
    ),

  refundFailed: (reference: string, cause?: unknown) =>
    createRetryableError(
      'PAYSTACK_REFUND_FAILED',
      `Paystack refund failed for reference: ${reference}`,
      cause
    ),

  invalidWebhookSignature: () =>
    createFatalError(
      'PAYSTACK_INVALID_WEBHOOK_SIGNATURE',
      'Paystack webhook signature validation failed. Payload rejected.'
    ),

  unknownWebhookEvent: (event: string) =>
    createFatalError(
      'PAYSTACK_UNKNOWN_WEBHOOK_EVENT',
      `Unrecognised Paystack webhook event: ${event}`
    ),

  requestTimeout: (cause?: unknown) =>
    createRetryableError(
      'PAYSTACK_REQUEST_TIMEOUT',
      'Paystack API request timed out.',
      cause
    ),

  networkError: (cause?: unknown) =>
    createRetryableError(
      'PAYSTACK_NETWORK_ERROR',
      'A network error occurred while contacting Paystack.',
      cause
    ),
} as const;
