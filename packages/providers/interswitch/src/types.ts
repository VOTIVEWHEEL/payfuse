/**
 * @package @payfuse/interswitch
 * @description Interswitch-specific raw API types.
 * These types reflect Interswitch's actual API response shapes
 * and must never be exported outside this package.
 * Consumers always receive normalized @payfuse/core types.
 */

/** Supported Interswitch deployment environments */
export type InterswitchEnvironment = 'sandbox' | 'production';

/** Raw response from Interswitch's OAuth2 token endpoint */
export interface InterswitchTokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  scope: string;
}

/**
 * In-memory token cache entry.
 * Tracks the token value and when it expires so we know
 * when to refresh without unnecessary API calls.
 */
export interface InterswitchTokenCache {
  accessToken: string;
  /** Unix timestamp (ms) at which this token expires */
  expiresAt: number;
}

/** Raw response from Interswitch's purchase initialization endpoint */
export interface InterswitchPurchaseResponse {
  paymentId: string;
  redirectUrl: string;
  transactionRef: string;
  amount: number;
  currency: string;
  message: string;
}

/**
 * Raw response from Interswitch's transaction query endpoint.
 * responseCode '00' means approved — all other codes are failures.
 */
export interface InterswitchQueryResponse {
  transactionRef: string;
  paymentRef: string;
  reversalRef: string | null;
  amount: number;
  currency: string;
  responseCode: string;
  responseDescription: string;
  paymentDate: string;
  customerEmail: string;
  customerName: string;
}

/** Raw Interswitch webhook payload shape */
export interface InterswitchWebhookPayload {
  transactionRef: string;
  paymentRef: string;
  amount: number;
  currency: string;
  responseCode: string;
  responseDescription: string;
  paymentDate: string;
  customerEmail: string;
}
