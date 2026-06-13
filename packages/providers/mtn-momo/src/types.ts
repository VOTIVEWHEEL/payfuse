/**
 * @package @payfuse/mtn-momo
 * @description MTN MoMo-specific raw API types.
 * These types reflect MTN MoMo's actual API response shapes
 * and must never be exported outside this package.
 * Consumers always receive normalized @payfuse/core types.
 */

/** Supported MTN MoMo deployment environments */
export type MtnEnvironment = 'sandbox' | 'production';

/** Raw response from MTN MoMo's OAuth2 token endpoint */
export interface MtnTokenResponse {
  access_token: string;
  token_type: 'access_token';
  expires_in: number;
}

/**
 * In-memory token cache entry.
 * Tracks the token value and when it expires so we
 * know when to refresh without unnecessary API calls.
 */
export interface MtnTokenCache {
  accessToken: string;
  /** Unix timestamp (ms) at which this token expires */
  expiresAt: number;
}

/**
 * Raw response from MTN MoMo's Request to Pay status endpoint.
 * MTN MoMo payments are async — a 202 Accepted is returned
 * on initiation and the actual status is polled via this type.
 */
export interface MtnRequestToPayStatus {
  amount: string;
  currency: string;
  financialTransactionId: string;
  externalId: string;
  payer: {
    partyIdType: 'MSISDN';
    partyId: string;
  };
  payerMessage: string;
  payeeNote: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  reason?: {
    code: string;
    message: string;
  };
}

/** Raw MTN MoMo webhook callback payload */
export interface MtnWebhookPayload {
  referenceId: string;
  status: 'SUCCESSFUL' | 'FAILED';
  financialTransactionId: string;
  amount: string;
  currency: string;
  externalId: string;
  payer: {
    partyIdType: 'MSISDN';
    partyId: string;
  };
  payerMessage: string;
  payeeNote: string;
}
