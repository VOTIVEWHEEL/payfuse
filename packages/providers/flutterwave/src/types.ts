/**
 * @package @payfuse/flutterwave
 * @description Flutterwave-specific raw API types.
 * These types reflect Flutterwave's actual API response shapes
 * and must never be exported outside this package.
 * Consumers always receive normalized @payfuse/core types.
 */

/** Raw response from Flutterwave's payments endpoint */
export interface FlutterwaveInitializeResponse {
  status: 'success' | 'error';
  message: string;
  data: {
    link: string;
  };
}

/** Raw response from Flutterwave's verify transaction endpoint */
export interface FlutterwaveVerifyResponse {
  status: 'success' | 'error';
  message: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    charged_amount: number;
    currency: string;
    status: 'successful' | 'failed' | 'pending';
    payment_type: string;
    created_at: string;
    meta: Record<string, unknown> | null;
    customer: {
      id: number;
      email: string;
      phone_number: string | null;
      name: string;
    };
  };
}

/** Raw response from Flutterwave's refund endpoint */
export interface FlutterwaveRefundResponse {
  status: 'success' | 'error';
  message: string;
  data: {
    id: number;
    amount_refunded: number;
    status: 'completed' | 'failed' | 'pending';
    flw_ref: string;
    tx_ref: string;
    currency: string;
    created_at: string;
  };
}

/** Raw Flutterwave webhook payload shape */
export interface FlutterwaveWebhookPayload {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
    meta: Record<string, unknown> | null;
    customer: {
      email: string;
      phone_number: string | null;
      name: string;
    };
  };
}
