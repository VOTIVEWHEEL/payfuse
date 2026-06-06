import { createHmac, randomUUID } from 'crypto';
import type {
  ChargeStatus,
  ChargeResponse,
  RefundResponse,
  WebhookEvent,
} from '@payfuse/core';
import type {
  PaystackVerifyResponse,
  PaystackRefundResponse,
  PaystackWebhookPayload,
} from './types';

/**
 * @package @payfuse/paystack
 * @description Pure utility functions for the Paystack adapter.
 * All functions here are stateless and side-effect free.
 */

/**
 * Generates a unique transaction reference prefixed with `pf_`
 * to distinguish PayFuse-originated transactions in Paystack's dashboard.
 */
export function generateReference(): string {
  return `pf_${randomUUID().replace(/-/g, '')}`;
}

/**
 * Maps Paystack's transaction status strings to PayFuse's
 * normalized `ChargeStatus` type.
 */
export function normalizeStatus(
  paystackStatus: string
): ChargeStatus {
  const statusMap: Record<string, ChargeStatus> = {
    success: 'success',
    failed: 'failed',
    abandoned: 'abandoned',
    pending: 'pending',
    reversed: 'reversed',
  };

  return statusMap[paystackStatus] ?? 'failed';
}

/**
 * Validates a Paystack webhook HMAC-SHA512 signature.
 * Returns true if valid, false if invalid.
 * Never throws — signature validation errors are handled by the caller.
 */
export function validateSignature(
  rawBody: string,
  signature: string,
  secretKey: string
): boolean {
  const hash = createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  return hash === signature;
}

/**
 * Transforms a raw Paystack verify response into a
 * normalized PayFuse `ChargeResponse`.
 */
export function normalizeVerifyResponse(
  raw: PaystackVerifyResponse,
  reference: string
): ChargeResponse {
  const { data } = raw;

  return {
    success: data.status === 'success',
    reference,
    providerReference: String(data.id),
    provider: 'paystack',
    status: normalizeStatus(data.status),
    amount: data.amount,
    currency: data.currency,
    message: raw.message,
    timestamp: new Date().toISOString(),
    raw,
  };
}

/**
 * Transforms a raw Paystack refund response into a
 * normalized PayFuse `RefundResponse`.
 */
export function normalizeRefundResponse(
  raw: PaystackRefundResponse,
  originalReference: string
): RefundResponse {
  const { refund } = raw.data;

  return {
    success: raw.status,
    refundReference: String(refund.id),
    originalReference,
    provider: 'paystack',
    amount: refund.amount,
    currency: refund.currency,
    status: refund.status === 'processed'
      ? 'success'
      : refund.status === 'failed'
      ? 'failed'
      : 'pending',
    message: raw.message,
    timestamp: refund.created_at,
    raw,
  };
}

/**
 * Transforms a raw Paystack webhook payload into a
 * normalized PayFuse `WebhookEvent`.
 */
export function normalizeWebhookEvent(
  raw: PaystackWebhookPayload
): WebhookEvent {
  const { data } = raw;

  return {
    provider: 'paystack',
    event: raw.event,
    reference: data.reference,
    amount: data.amount,
    currency: data.currency,
    status: normalizeStatus(data.status),
    timestamp: data.paid_at ?? new Date().toISOString(),
    metadata: data.metadata ?? undefined,
    raw,
  };
}
