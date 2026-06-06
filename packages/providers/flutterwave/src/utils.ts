import { randomUUID } from 'crypto';
import type {
  ChargeStatus,
  ChargeResponse,
  RefundResponse,
  WebhookEvent,
} from '@payfuse/core';
import type {
  FlutterwaveVerifyResponse,
  FlutterwaveRefundResponse,
  FlutterwaveWebhookPayload,
} from './types';

/**
 * @package @payfuse/flutterwave
 * @description Pure utility functions for the Flutterwave adapter.
 * All functions here are stateless and side-effect free.
 */

/**
 * Generates a unique transaction reference prefixed with `pf_`
 * to distinguish PayFuse-originated transactions in
 * Flutterwave's dashboard.
 */
export function generateReference(): string {
  return `pf_${randomUUID().replace(/-/g, '')}`;
}

/**
 * Maps Flutterwave's transaction status strings to PayFuse's
 * normalized `ChargeStatus` type.
 *
 * Note: Flutterwave uses 'successful' (not 'success') for
 * completed transactions.
 */
export function normalizeStatus(
  flutterwaveStatus: string
): ChargeStatus {
  const statusMap: Record<string, ChargeStatus> = {
    successful: 'success',
    success: 'success',
    failed: 'failed',
    pending: 'pending',
    abandoned: 'abandoned',
    reversed: 'reversed',
  };

  return statusMap[flutterwaveStatus] ?? 'failed';
}

/**
 * Validates a Flutterwave webhook signature.
 * Flutterwave uses a direct secret hash comparison —
 * not HMAC. Returns true if valid, false if invalid.
 */
export function validateSignature(
  signature: string,
  secretHash: string
): boolean {
  return signature === secretHash;
}

/**
 * Transforms a raw Flutterwave verify response into a
 * normalized PayFuse `ChargeResponse`.
 */
export function normalizeVerifyResponse(
  raw: FlutterwaveVerifyResponse,
  reference: string
): ChargeResponse {
  const { data } = raw;

  return {
    success: data.status === 'successful',
    reference,
    providerReference: String(data.id),
    provider: 'flutterwave',
    status: normalizeStatus(data.status),
    amount: data.amount,
    currency: data.currency,
    message: raw.message,
    timestamp: data.created_at,
    raw,
  };
}

/**
 * Transforms a raw Flutterwave refund response into a
 * normalized PayFuse `RefundResponse`.
 */
export function normalizeRefundResponse(
  raw: FlutterwaveRefundResponse,
  originalReference: string
): RefundResponse {
  const { data } = raw;

  return {
    success: raw.status === 'success',
    refundReference: String(data.id),
    originalReference,
    provider: 'flutterwave',
    amount: data.amount_refunded,
    currency: data.currency,
    status: data.status === 'completed'
      ? 'success'
      : data.status === 'failed'
      ? 'failed'
      : 'pending',
    message: raw.message,
    timestamp: data.created_at,
    raw,
  };
}

/**
 * Transforms a raw Flutterwave webhook payload into a
 * normalized PayFuse `WebhookEvent`.
 */
export function normalizeWebhookEvent(
  raw: FlutterwaveWebhookPayload
): WebhookEvent {
  const { data } = raw;

  return {
    provider: 'flutterwave',
    event: raw.event,
    reference: data.tx_ref,
    amount: data.amount,
    currency: data.currency,
    status: normalizeStatus(data.status),
    timestamp: data.created_at ?? new Date().toISOString(),
    metadata: data.meta ?? undefined,
    raw,
  };
}
