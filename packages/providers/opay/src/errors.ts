import type { PayFuseError } from '@payfuse/core';

/**
 * @package @payfuse/opay
 * @description Structured error factory for the OPay adapter.
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
    provider: 'opay',
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
    provider: 'opay',
    severity: 'fatal',
    cause,
  };
}

/** Pre-defined OPay error factories for common failure scenarios */
export const OpayErrors = {
  invalidCredentials: (cause?: unknown) =>
    createFatalError(
      'OPAY_INVALID_CREDENTIALS',
      'OPay merchantId or appSecret is missing or malformed.',
      cause
    ),

  initializeFailed: (message: string, cause?: unknown) =>
    createRetryableError(
      'OPAY_INITIALIZE_FAILED',
      `OPay cashier creation failed: ${message}`,
      cause
    ),

  verifyFailed: (reference: string, cause?: unknown) =>
    createRetryableError(
      'OPAY_VERIFY_FAILED',
      `OPay transaction query failed for reference: ${reference}`,
      cause
    ),

  refundFailed: (reference: string, cause?: unknown) =>
    createRetryableError(
      'OPAY_REFUND_FAILED',
      `OPay refund failed for reference: ${reference}`,
      cause
    ),

  invalidWebhookSignature: () =>
    createFatalError(
      'OPAY_INVALID_WEBHOOK_SIGNATURE',
      'OPay webhook signature validation failed. Payload rejected.'
    ),

  requestTimeout: (cause?: unknown) =>
    createRetryableError(
      'OPAY_REQUEST_TIMEOUT',
      'OPay API request timed out.',
      cause
    ),

  networkError: (cause?: unknown) =>
    createRetryableError(
      'OPAY_NETWORK_ERROR',
      'A network error occurred while contacting OPay.',
      cause
    ),
} as const;
