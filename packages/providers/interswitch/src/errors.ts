import type { PayFuseError } from '@payfuse/core';

/**
 * @package @payfuse/interswitch
 * @description Structured error factory for the Interswitch adapter.
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
    provider: 'interswitch',
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
    provider: 'interswitch',
    severity: 'fatal',
    cause,
  };
}

/** Pre-defined Interswitch error factories for common failure scenarios */
export const InterswitchErrors = {
  invalidCredentials: (cause?: unknown) =>
    createFatalError(
      'INTERSWITCH_INVALID_CREDENTIALS',
      'Interswitch clientId or clientSecret is missing or malformed.',
      cause
    ),

  tokenFetchFailed: (cause?: unknown) =>
    createRetryableError(
      'INTERSWITCH_TOKEN_FETCH_FAILED',
      'Failed to obtain Interswitch OAuth2 access token.',
      cause
    ),

  initializeFailed: (message: string, cause?: unknown) =>
    createRetryableError(
      'INTERSWITCH_INITIALIZE_FAILED',
      `Interswitch payment initialization failed: ${message}`,
      cause
    ),

  verifyFailed: (reference: string, cause?: unknown) =>
    createRetryableError(
      'INTERSWITCH_VERIFY_FAILED',
      `Interswitch transaction query failed for reference: ${reference}`,
      cause
    ),

  refundFailed: (reference: string, cause?: unknown) =>
    createRetryableError(
      'INTERSWITCH_REFUND_FAILED',
      `Interswitch refund failed for reference: ${reference}`,
      cause
    ),

  invalidWebhookSignature: () =>
    createFatalError(
      'INTERSWITCH_INVALID_WEBHOOK_SIGNATURE',
      'Interswitch webhook signature validation failed. Payload rejected.'
    ),

  requestTimeout: (cause?: unknown) =>
    createRetryableError(
      'INTERSWITCH_REQUEST_TIMEOUT',
      'Interswitch API request timed out.',
      cause
    ),

  networkError: (cause?: unknown) =>
    createRetryableError(
      'INTERSWITCH_NETWORK_ERROR',
      'A network error occurred while contacting Interswitch.',
      cause
    ),
} as const;
