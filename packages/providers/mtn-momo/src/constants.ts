/**
 * @package @payfuse/mtn-momo
 * @description MTN MoMo-specific constants.
 * Never hardcode these values anywhere outside this file.
 */

export const MTN_MOMO_SANDBOX_BASE_URL =
  'https://sandbox.momodeveloper.mtn.com';

export const MTN_MOMO_PRODUCTION_BASE_URL =
  'https://proxy.momoapi.mtn.com';

export const MTN_MOMO_ENDPOINTS = {
  /** OAuth2 token endpoint for Collections product */
  TOKEN: '/collection/token/',
  /** Initiate a Request to Pay */
  REQUEST_TO_PAY: '/collection/v1_0/requesttopay',
  /** Check status of a Request to Pay by referenceId */
  REQUEST_TO_PAY_STATUS: '/collection/v1_0/requesttopay',
} as const;

/**
 * MTN MoMo transaction status values as returned by the API.
 * These are different from PayFuse's normalized ChargeStatus.
 */
export const MTN_MOMO_STATUS = {
  PENDING: 'PENDING',
  SUCCESSFUL: 'SUCCESSFUL',
  FAILED: 'FAILED',
} as const;

/**
 * MTN MoMo party identifier type for phone numbers.
 * MSISDN = Mobile Station International Subscriber Directory Number
 * i.e. the customer's phone number in E.164 format.
 */
export const MTN_PARTY_ID_TYPE = 'MSISDN' as const;

/**
 * Access token lifetime in seconds as issued by MTN MoMo.
 * Tokens expire after 3600s (1 hour). We refresh 60s early
 * to avoid edge-case expiry mid-request.
 */
export const MTN_TOKEN_EXPIRY_SECONDS = 3600;
export const MTN_TOKEN_REFRESH_BUFFER_SECONDS = 60;
