import type { PayFuseError } from '@payfuse/core';

/**
 * @package @payfuse/mtn-momo
 * @description Structured error factory for the MTN MoMo adapter.
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
    provider: 'mtn-momo',
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
    provider: 'mtn-momo',
    severity: 'fatal',
    cause,
  };
}

/** Pre-defined MTN MoMo error factories for common failure scenarios */
export const MtnMomoErrors = {
  invalidCredentials: (cause?: unknown) =>
    createFatalError(
      'MTN_MOMO_INVALID_CREDENTIALS',
      'MTN MoMo credentials are missing or malformed.',
      cause
    ),

  missingPhoneNumber: () =>
    createFatalError(
      'MTN_MOMO_MISSING_PHONE_NUMBER',
      'phoneNumber is required for MTN MoMo payments. ' +
      'Provide it in E.164 format e.g. +2348012345678.'
    ),

  tokenFetchFailed: (cause?: unknown) =>
    createRetryableError(
      'MTN_MOMO_TOKEN_FETCH_FAILED',
      'Failed to obtain MTN MoMo OAuth2 access token.',
      cause
    ),

  chargeFailed: (message: string, cause?: unknown) =>
    createRetryableError(
      'MTN_MOMO_CHARGE_FAILED',
      `MTN MoMo Request to Pay failed: ${message}`,
      cause
    ),

  verifyFailed: (reference: string, cause?: unknown) =>
    createRetryableError(
      'MTN_MOMO_VERIFY_FAILED',
      `MTN MoMo status check failed for reference: ${reference}`,
      cause
    ),

  refundNotSupported: () =>
    createFatalError(
      'MTN_MOMO_REFUND_NOT_SUPPORTED',
      'MTN MoMo does not support refunds via the Collections API. ' +
      'Use the Disbursements product to reverse funds manually.'
    ),

  invalidWebhookSignature: () =>
    createFatalError(
      'MTN_MOMO_INVALID_WEBHOOK_SIGNATURE',
      'MTN MoMo webhook signature validation failed. Payload rejected.'
    ),

  requestTimeout: (cause?: unknown) =>
    createRetryableError(
      'MTN_MOMO_REQUEST_TIMEOUT',
      'MTN MoMo API request timed out.',
      cause
    ),

  networkError: (cause?: unknown) =>
    createRetryableError(
      'MTN_MOMO_NETWORK_ERROR',
      'A network error occurred while contacting MTN MoMo.',
      cause
    ),
} as const;
