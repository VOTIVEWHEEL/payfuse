/**
 * @package @payfuse/opay
 * @description OPay-specific constants.
 * Never hardcode these values anywhere outside this file.
 */

export const OPAY_SANDBOX_BASE_URL =
  'https://sandboxapi.opaycheckout.com';

export const OPAY_PRODUCTION_BASE_URL =
  'https://api.opaycheckout.com';

export const OPAY_ENDPOINTS = {
  /** Initialize a Cashier hosted payment */
  CASHIER_CREATE: '/api/v1/international/cashier/create',
  /** Query transaction status by reference */
  CASHIER_QUERY: '/api/v1/international/cashier/query',
  /** Initiate a refund on a completed transaction */
  CASHIER_REFUND: '/api/v1/international/cashier/refund',
} as const;

/**
 * OPay success response code.
 * All responses with this code are considered successful.
 * All other codes indicate failure.
 */
export const OPAY_SUCCESS_CODE = '00000' as const;

/**
 * OPay transaction status values as returned by the API.
 */
export const OPAY_STATUS = {
  SUCCESS: 'SUCCESS',
  PENDING: 'PENDING',
  FAIL: 'FAIL',
  CLOSE: 'CLOSE',
} as const;

/**
 * OPay webhook signature header name.
 * OPay signs webhook payloads with HMAC-SHA512 using your appSecret.
 */
export const OPAY_SIGNATURE_HEADER = 'sign' as const;

/**
 * OPay payment expiry duration in minutes.
 * Defaults to 30 minutes — customers must complete
 * payment within this window.
 */
export const OPAY_DEFAULT_EXPIRY_MINUTES = 30;
