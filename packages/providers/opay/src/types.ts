/**
 * @package @payfuse/opay
 * @description OPay-specific raw API types.
 * These types reflect OPay's actual API response shapes
 * and must never be exported outside this package.
 * Consumers always receive normalized @payfuse/core types.
 */

/** Supported OPay deployment environments */
export type OpayEnvironment = 'sandbox' | 'production';

/**
 * OPay API base response wrapper.
 * Every OPay response is wrapped in this envelope.
 * code '00000' means success.
 */
export interface OpayBaseResponse<T> {
  code: string;
  message: string;
  data: T;
}

/** Data payload from OPay's cashier create endpoint */
export interface OpayCashierCreateData {
  /** The hosted checkout URL to redirect the customer to */
  cashierUrl: string;
  /** OPay's internal order number */
  orderNo: string;
  /** Your transaction reference */
  reference: string;
}

/** Data payload from OPay's cashier query endpoint */
export interface OpayCashierQueryData {
  /** OPay's internal order number */
  orderNo: string;
  /** Your transaction reference */
  reference: string;
  /** Transaction amount */
  amount: number;
  currency: string;
  status: 'SUCCESS' | 'PENDING' | 'FAIL' | 'CLOSE';
  paymentTime: string;
  failReason: string | null;
}

/** Data payload from OPay's refund endpoint */
export interface OpayRefundData {
  refundOrderNo: string;
  reference: string;
  refundAmount: number;
  currency: string;
  status: 'SUCCESS' | 'PENDING' | 'FAIL';
  refundTime: string;
}

/** Raw OPay webhook payload shape */
export interface OpayWebhookPayload {
  orderNo: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  paymentTime: string;
  country: string;
  failReason: string | null;
}

/** OPay customer info required for payment initialization */
export interface OpayUserInfo {
  userId: string;
  userName: string;
  userEmail: string;
  userMobile?: string;
}
