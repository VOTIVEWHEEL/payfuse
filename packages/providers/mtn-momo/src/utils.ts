import { randomUUID, createHmac } from 'crypto';
import type {
  ChargeStatus,
  ChargeResponse,
  WebhookEvent,
} from '@payfuse/core';
import type {
  MtnRequestToPayStatus,
  MtnWebhookPayload,
} from './types';

/**
 * @package @payfuse/mtn-momo
 * @description Pure utility functions for the MTN MoMo adapter.
 * All functions here are stateless and side-effect free.
 */

/**
 * Generates a UUID v4 reference.
 * MTN MoMo requires the X-Reference-Id header to be a valid UUID —
 * unlike Paystack/Flutterwave which accept arbitrary strings.
 */
export function generateReference(): string {
  return randomUUID();
}

/**
 * Maps MTN MoMo's transaction status strings to PayFuse's
 * normalized `ChargeStatus` type.
 */
export function normalizeStatus(
  mtnStatus: string
): ChargeStatus {
  const statusMap: Record<string, ChargeStatus> = {
    SUCCESSFUL: 'success',
    FAILED: 'failed',
    PENDING: 'pending',
  };

  return statusMap[mtnStatus] ?? 'failed';
}

/**
 * Validates an MTN MoMo webhook using HMAC-SHA256.
 * MTN MoMo signs webhooks with your API secret.
 * Returns true if valid, false if invalid.
 */
export function validateSignature(
  rawBody: string,
  signature: string,
  apiSecret: string
): boolean {
  const hash = createHmac('sha256', apiSecret)
    .update(rawBody)
    .digest('hex');

  return hash === signature;
}

/**
 * Encodes MTN MoMo API credentials to Base64 for Basic Auth.
 * Used when requesting an OAuth2 access token.
 */
export function encodeBasicAuth(
  apiUserId: string,
  apiKey: string
): string {
  return Buffer.from(`${apiUserId}:${apiKey}`).toString('base64');
}

/**
 * Transforms a raw MTN MoMo Request to Pay status response
 * into a normalized PayFuse `ChargeResponse`.
 */
export function normalizeStatusResponse(
  raw: MtnRequestToPayStatus,
  reference: string
): ChargeResponse {
  return {
    success: raw.status === 'SUCCESSFUL',
    reference,
    providerReference: raw.financialTransactionId ?? reference,
    provider: 'mtn-momo',
    status: normalizeStatus(raw.status),
    amount: Number(raw.amount),
    currency: raw.currency,
    message: raw.status === 'FAILED'
      ? (raw.reason?.message ?? 'Payment failed')
      : raw.status,
    timestamp: new Date().toISOString(),
    raw,
  };
}

/**
 * Transforms a raw MTN MoMo webhook payload into a
 * normalized PayFuse `WebhookEvent`.
 */
export function normalizeWebhookEvent(
  raw: MtnWebhookPayload
): WebhookEvent {
  return {
    provider: 'mtn-momo',
    event: `charge.${raw.status.toLowerCase()}`,
    reference: raw.referenceId,
    amount: Number(raw.amount),
    currency: raw.currency,
    status: normalizeStatus(raw.status),
    timestamp: new Date().toISOString(),
    raw,
  };
}
