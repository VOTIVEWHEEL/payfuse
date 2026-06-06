/**
 * @package @payfuse/paystack
 * @description Paystack-specific raw API types.
 * These types reflect Paystack's actual API response shapes
 * and must never be exported outside this package.
 * Consumers always receive normalized @payfuse/core types.
 */

/** Raw response from Paystack's initialize transaction endpoint */
export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

/** Raw response from Paystack's verify transaction endpoint */
export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: 'success' | 'failed' | 'abandoned' | 'pending';
    reference: string;
    amount: number;
    currency: string;
    paid_at: string;
    created_at: string;
    channel: string;
    metadata: Record<string, unknown> | null;
    authorization: {
      authorization_code: string;
      last4: string;
      bank: string;
      brand: string;
    };
    customer: {
      email: string;
      phone: string | null;
    };
  };
}

/** Raw response from Paystack's refund endpoint */
export interface PaystackRefundResponse {
  status: boolean;
  message: string;
  data: {
    transaction: {
      id: number;
      reference: string;
      amount: number;
      currency: string;
    };
    dispute: null | Record<string, unknown>;
    refund: {
      id: number;
      domain: string;
      amount: number;
      currency: string;
      created_at: string;
      status: 'pending' | 'processing' | 'processed' | 'failed';
    };
  };
}

/** Raw Paystack webhook payload shape */
export interface PaystackWebhookPayload {
  event: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    paid_at: string;
    metadata: Record<string, unknown> | null;
    customer: {
      email: string;
      phone: string | null;
    };
  };
}
