import type { PayFuseError } from '@payfuse/core';

/**
 * @package @payfuse/flutterwave
 * @description Structured error factory for the Flutterwave adapter.
 * All errors thrown by this adapter must be created through
 * these factories — never throw raw Error objects.
 */

export function createRetryableError(
  code: string,
  message: string,
  cause?: unknown
): PayFuseError {
  return {
    code,
    message,
    provider: 'flutterwave',
    severity: 'retryable',
    cause,
  };
}

export function createFatalError(
  code: string,
  message: string,
  cause?: unknown
): PayFuseError {
  return {
    code,
    message,
    provider: 'flutterwave',
    severity: 'fatal',
    cause,
  };
}

/** Pre-defined Flutterwave error factories for common failure scenarios */
export const FlutterwaveErrors = {
  invalidCredentials: (cause?: unknown) =>
    createFatalError(
      'FLUTTERWAVE_INVALID_CREDENTIALS',
      'Flutterwave secret key is missing or malformed.',
      cause
    ),

  initializeFailed: (message: string, cause?: unknown) =>
    createRetryableError(
      'FLUTTERWAVE_INITIALIZE_FAILED',
      `Flutterwave charge initialization failed: ${message}`,
      cause
    ),

  verifyFailed: (reference: string, cause?: unknown) =>
    createRetryableError(
      'FLUTTERWAVE_VERIFY_FAILED',
      `Flutterwave verification failed for reference: ${reference}`,
      cause
    ),

  refundFailed: (reference: string, cause?: unknown) =>
    createRetryableError(
      'FLUTTERWAVE_REFUND_FAILED',
      `Flutterwave refund failed for reference: ${reference}`,
      cause
    ),

  invalidWebhookSignature: () =>
    createFatalError(
      'FLUTTERWAVE_INVALID_WEBHOOK_SIGNATURE',
      'Flutterwave webhook signature validation failed. Payload rejected.'
    ),

  transactionNotFound: (reference: string, cause?: unknown) =>
    createFatalError(
      'FLUTTERWAVE_TRANSACTION_NOT_FOUND',
      `No Flutterwave transaction found for reference: ${reference}`,
      cause
    ),

  requestTimeout: (cause?: unknown) =>
    createRetryableError(
      'FLUTTERWAVE_REQUEST_TIMEOUT',
      'Flutterwave API request timed out.',
      cause
    ),

  networkError: (cause?: unknown) =>
    createRetryableError(
      'FLUTTERWAVE_NETWORK_ERROR',
      'A network error occurred while contacting Flutterwave.',
      cause
    ),
} as const;
