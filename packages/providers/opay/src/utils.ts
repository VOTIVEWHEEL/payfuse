import { createHmac, randomUUID } from 'crypto';
import type {
  ChargeStatus,
  ChargeResponse,
  RefundResponse,
  WebhookEvent,
} from '@payfuse/core';
import type {
  OpayCashierQueryData,
  OpayRefundData,
  OpayWebhookPayload,
} from './types';
import { OPAY_SUCCESS_CODE, OPAY_STATUS } from './constants';

/**
 * @package @payfuse/opay
 * @description Pure utility functions for the OPay adapter.
 * All functions here are stateless and side-effect free.
 */

/**
 * Generates a unique transaction reference prefixed with `pf_`
 * to distinguish PayFuse-originated transactions in
 * OPay's dashboard.
 */
export function generateReference(): string {
  return `pf_${randomUUID().replace(/-/g, '')}`;
}

/**
 * Computes the OPay HMAC-SHA512 request signature.
 *
 * OPay's signing algorithm:
 * 1. Sort all request body keys alphabetically
 * 2. Stringify the sorted object
 * 3. HMAC-SHA512 with appSecret
 * 4. Uppercase hex digest
 */
export function buildSignature(
  requestBody: Record<string, unknown>,
  appSecret: string
): string {
  const sortedKeys = Object.keys(requestBody).sort();

  const sortedBody: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedBody[key] = requestBody[key];
  }

  return createHmac('sha512', appSecret)
    .update(JSON.stringify(sortedBody))
    .digest('hex')
    .toUpperCase();
}

/**
 * Validates an OPay webhook signature.
 * OPay signs webhook payloads using the same HMAC-SHA512
 * algorithm used for request signing.
 * Returns true if valid, false if invalid.
 */
export function validateSignature(
  payload: Record<string, unknown>,
  signature: string,
  appSecret: string
): boolean {
  const expected = buildSignature(payload, appSecret);
  return expected === signature.toUpperCase();
}

/**
 * Calculates the payment expiry timestamp.
 * Returns an ISO 8601 string `minutes` from now.
 */
export function buildExpiryTime(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

/**
 * Maps OPay's transaction status strings to PayFuse's
 * normalized `ChargeStatus` type.
 */
export function normalizeStatus(
  opayStatus: string
): ChargeStatus {
  const statusMap: Record<string, ChargeStatus> = {
    [OPAY_STATUS.SUCCESS]: 'success',
    [OPAY_STATUS.PENDING]: 'pending',
    [OPAY_STATUS.FAIL]: 'failed',
    [OPAY_STATUS.CLOSE]: 'abandoned',
  };

  return statusMap[opayStatus] ?? 'failed';
}

/**
 * Transforms a raw OPay cashier query response into a
 * normalized PayFuse `ChargeResponse`.
 */
export function normalizeQueryResponse(
  raw: OpayCashierQueryData,
  reference: string
): ChargeResponse {
  return {
    success: raw.status === OPAY_STATUS.SUCCESS,
    reference,
    providerReference: raw.orderNo,
    provider: 'opay',
    status: normalizeStatus(raw.status),
    amount: raw.amount,
    currency: raw.currency,
    message: raw.failReason ?? raw.status,
    timestamp: raw.paymentTime ?? new Date().toISOString(),
    raw,
  };
}

/**
 * Transforms a raw OPay refund response into a
 * normalized PayFuse `RefundResponse`.
 */
export function normalizeRefundResponse(
  raw: OpayRefundData,
  originalReference: string
): RefundResponse {
  return {
    success: raw.status === OPAY_STATUS.SUCCESS,
    refundReference: raw.refundOrderNo,
    originalReference,
    provider: 'opay',
    amount: raw.refundAmount,
    currency: raw.currency,
    status: raw.status === 'SUCCESS'
      ? 'success'
      : raw.status === 'FAIL'
      ? 'failed'
      : 'pending',
    message: raw.status,
    timestamp: raw.refundTime ?? new Date().toISOString(),
    raw,
  };
}

/**
 * Transforms a raw OPay webhook payload into a
 * normalized PayFuse `WebhookEvent`.
 */
export function normalizeWebhookEvent(
  raw: OpayWebhookPayload
): WebhookEvent {
  return {
    provider: 'opay',
    event: `charge.${normalizeStatus(raw.status)}`,
    reference: raw.reference,
    amount: raw.amount,
    currency: raw.currency,
    status: normalizeStatus(raw.status),
    timestamp: raw.paymentTime ?? new Date().toISOString(),
    metadata: raw.failReason
      ? { failReason: raw.failReason }
      : undefined,
    raw,
  };
}
