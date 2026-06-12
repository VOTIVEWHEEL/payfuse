/**
 * @package @payfuse/flutterwave
 * @description Flutterwave-specific constants. Never hardcode
 * these values anywhere outside this file.
 */

export const FLUTTERWAVE_BASE_URL = 'https://api.flutterwave.com/v3';

export const FLUTTERWAVE_ENDPOINTS = {
  PAYMENTS: '/payments',
  VERIFY: '/transactions',
  REFUND: '/transactions',
} as const;

/**
 * Flutterwave webhook verification header name.
 * Flutterwave sends your configured secret hash in this header.
 * Validate by direct string comparison — not HMAC.
 */
export const FLUTTERWAVE_SIGNATURE_HEADER = 'verif-hash';

/**
 * Flutterwave event types normalized to dot-notation.
 * Extend this as new event types are supported.
 */
export const FLUTTERWAVE_EVENTS = {
  CHARGE_COMPLETED: 'charge.completed',
  TRANSFER_COMPLETED: 'transfer.completed',
  REFUND_COMPLETED: 'refund.completed',
} as const;
