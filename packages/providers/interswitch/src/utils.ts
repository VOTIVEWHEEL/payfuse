import { createHmac, createHash, randomUUID } from 'crypto';
import type {
  ChargeStatus,
  ChargeResponse,
  RefundResponse,
  WebhookEvent,
} from '@payfuse/core';
import type {
  InterswitchQueryResponse,
  InterswitchWebhookPayload,
} from './types';
import { INTERSWITCH_APPROVED_CODE, INTERSWITCH_STATUS_CODES } from './constants';

/**
 * @package @payfuse/interswitch
 * @description Pure utility functions for the Interswitch adapter.
 * All functions here are stateless and side-effect free.
 */

/**
 * Generates a unique transaction reference prefixed with `pf_`
 * to distinguish PayFuse-originated transactions in
 * Interswitch's dashboard.
 */
export function generateReference(): string {
  return `pf_${randomUUID().replace(/-/g, '')}`;
}

/**
 * Encodes Interswitch API credentials to Base64 for Basic Auth.
 * Used when requesting an OAuth2 access token.
 */
export function encodeBasicAuth(
  clientId: string,
  clientSecret: string
): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

/**
 * Builds the Interswitch HMAC-SHA512 request signature.
 *
 * Signing string format:
 * clientId + "\n" + timestamp + "\n" + nonce + "\n"
 * + httpVerb + "\n" + requestPath + "\n"
 * + base64(MD5(requestBody)) + "\n"
 */
export function buildRequestSignature(params: {
  clientId: string;
  clientSecret: string;
  timestamp: string;
  nonce: string;
  httpVerb: string;
  requestPath: string;
  requestBody?: string;
}): string {
  const {
    clientId,
    clientSecret,
    timestamp,
    nonce,
    httpVerb,
    requestPath,
    requestBody = '',
  } = params;

  const bodyHash = requestBody
    ? Buffer.from(
        createHash('md5').update(requestBody).digest()
      ).toString('base64')
    : '';

  const signingString = [
    clientId,
    timestamp,
    nonce,
    httpVerb.toUpperCase(),
    requestPath,
    bodyHash,
    '',
  ].join('\n');

  return Buffer.from(
    createHmac('sha512', clientSecret)
      .update(signingString)
      .digest()
  ).toString('base64');
}

/**
 * Validates an Interswitch webhook HMAC-SHA512 signature.
 * Returns true if valid, false if invalid.
 */
export function validateSignature(
  rawBody: string,
  signature: string,
  clientSecret: string
): boolean {
  const hash = createHmac('sha512', clientSecret)
    .update(rawBody)
    .digest('base64');

  return hash === signature;
}

/**
 * Maps Interswitch's response codes to PayFuse's
 * normalized `ChargeStatus` type.
 */
export function normalizeStatus(
  responseCode: string
): ChargeStatus {
  if (responseCode === INTERSWITCH_APPROVED_CODE) return 'success';
  if (responseCode === INTERSWITCH_STATUS_CODES.PENDING) return 'pending';
  if (responseCode === INTERSWITCH_STATUS_CODES.REVERSED) return 'reversed';
  return 'failed';
}

/**
 * Transforms a raw Interswitch query response into a
 * normalized PayFuse `ChargeResponse`.
 */
export function normalizeQueryResponse(
  raw: InterswitchQueryResponse,
  reference: string
): ChargeResponse {
  const status = normalizeStatus(raw.responseCode);

  return {
    success: status === 'success',
    reference,
    providerReference: raw.paymentRef,
    provider: 'interswitch',
    status,
    amount: raw.amount,
    currency: raw.currency,
    message: raw.responseDescription,
    timestamp: raw.paymentDate ?? new Date().toISOString(),
    raw,
  };
}

/**
 * Transforms a raw Interswitch refund response into a
 * normalized PayFuse `RefundResponse`.
 */
export function normalizeRefundResponse(
  raw: InterswitchQueryResponse,
  originalReference: string
): RefundResponse {
  const status = normalizeStatus(raw.responseCode);

  return {
    success: status === 'success',
    refundReference: raw.reversalRef ?? raw.paymentRef,
    originalReference,
    provider: 'interswitch',
    amount: raw.amount,
    currency: raw.currency,
    status: status === 'success'
      ? 'success'
      : status === 'pending'
      ? 'pending'
      : 'failed',
    message: raw.responseDescription,
    timestamp: raw.paymentDate ?? new Date().toISOString(),
    raw,
  };
}

/**
 * Transforms a raw Interswitch webhook payload into a
 * normalized PayFuse `WebhookEvent`.
 */
export function normalizeWebhookEvent(
  raw: InterswitchWebhookPayload
): WebhookEvent {
  return {
    provider: 'interswitch',
    event: `charge.${normalizeStatus(raw.responseCode)}`,
    reference: raw.transactionRef,
    amount: raw.amount,
    currency: raw.currency,
    status: normalizeStatus(raw.responseCode),
    timestamp: raw.paymentDate ?? new Date().toISOString(),
    raw,
  };
}
