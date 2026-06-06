/**
 * @package @payfuse/paystack
 * @description Paystack-specific constants. Never hardcode these
 * values anywhere outside this file.
 */

export const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export const PAYSTACK_ENDPOINTS = {
  INITIALIZE: '/transaction/initialize',
  VERIFY: '/transaction/verify',
  REFUND: '/refund',
} as const;

/**
 * Paystack webhook signature header name.
 * Used to validate incoming webhook authenticity.
 */
export const PAYSTACK_SIGNATURE_HEADER = 'x-paystack-signature';

/**
 * Paystack event types normalized to dot-notation.
 * Extend this as new event types are supported.
 */
export const PAYSTACK_EVENTS = {
  CHARGE_SUCCESS: 'charge.success',
  CHARGE_FAILED: 'charge.failed',
  TRANSFER_SUCCESS: 'transfer.success',
  TRANSFER_FAILED: 'transfer.failed',
  REFUND_PROCESSED: 'refund.processed',
} as const;
