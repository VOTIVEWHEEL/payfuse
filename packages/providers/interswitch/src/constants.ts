/**
 * @package @payfuse/interswitch
 * @description Interswitch-specific constants.
 * Never hardcode these values anywhere outside this file.
 */

export const INTERSWITCH_SANDBOX_BASE_URL =
  'https://qa.interswitchng.com';

export const INTERSWITCH_PRODUCTION_BASE_URL =
  'https://api.interswitchgroup.com';

export const INTERSWITCH_ENDPOINTS = {
  /** OAuth2 token endpoint */
  TOKEN: '/passport/oauth/token',
  /** Initialize a Webpay hosted payment */
  PURCHASE: '/collections/api/v1/purchases',
  /** Query transaction status by reference */
  QUERY: '/collections/api/v1/purchases',
} as const;

/**
 * Interswitch OAuth2 grant type.
 * Interswitch uses client_credentials for server-to-server auth.
 */
export const INTERSWITCH_GRANT_TYPE = 'client_credentials' as const;

/**
 * Interswitch response code for approved transactions.
 * All other codes indicate failure or a pending state.
 */
export const INTERSWITCH_APPROVED_CODE = '00' as const;

/**
 * Interswitch webhook signature header.
 * Used to validate incoming webhook payload authenticity.
 */
export const INTERSWITCH_SIGNATURE_HEADER = 'x-interswitch-signature' as const;

/**
 * Interswitch access token lifetime in seconds.
 * Tokens expire after 3600s. We refresh 60s early to avoid
 * edge-case expiry mid-request.
 */
export const INTERSWITCH_TOKEN_EXPIRY_SECONDS = 3600;
export const INTERSWITCH_TOKEN_REFRESH_BUFFER_SECONDS = 60;

/**
 * Interswitch transaction status codes returned
 * by the query endpoint.
 */
export const INTERSWITCH_STATUS_CODES = {
  APPROVED: '00',
  PENDING: 'T0',
  REVERSED: '09',
} as const;
