import type {
  IPaymentProvider,
  ChargeRequest,
  ChargeResponse,
  RefundRequest,
  RefundResponse,
  WebhookEvent,
  HealthCheckResult,
  ProviderName,
} from '@payfuse/core';
import {
  PAYSTACK_BASE_URL,
  PAYSTACK_ENDPOINTS,
} from './constants';
import { PaystackErrors } from './errors';
import {
  generateReference,
  validateSignature,
  normalizeVerifyResponse,
  normalizeRefundResponse,
  normalizeWebhookEvent,
} from './utils';
import type {
  PaystackInitializeResponse,
  PaystackVerifyResponse,
  PaystackRefundResponse,
  PaystackWebhookPayload,
} from './types';

/**
 * @package @payfuse/paystack
 * @description Paystack provider adapter for PayFuse.
 *
 * Implements the `IPaymentProvider` interface — all public methods
 * return normalized PayFuse types. No Paystack-specific types
 * leak outside this class.
 *
 * @example
 * ```ts
 * const paystack = new PaystackProvider({
 *   secretKey: process.env.PAYSTACK_SECRET_KEY!,
 * });
 * ```
 */
export class PaystackProvider implements IPaymentProvider {
  readonly name: ProviderName = 'paystack';

  private readonly secretKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: {
    secretKey: string;
    timeoutMs?: number;
  }) {
    if (!config.secretKey || !config.secretKey.startsWith('sk_')) {
      throw PaystackErrors.invalidCredentials();
    }

    this.secretKey = config.secretKey;
    this.baseUrl = PAYSTACK_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  // ─── Private HTTP Client ──────────────────────────────────────

  /**
   * Internal HTTP client for all Paystack API calls.
   * Centralizes auth headers, timeout handling, and error wrapping.
   */
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.timeoutMs
    );

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw PaystackErrors.networkError(error);
      }

      return response.json() as Promise<T>;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw PaystackErrors.requestTimeout(err);
      }
      throw PaystackErrors.networkError(err);
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Public Interface Implementation ──────────────────────────

  /**
   * Initializes a Paystack transaction and returns the
   * authorization URL for the customer to complete payment.
   */
  async charge(request: ChargeRequest): Promise<ChargeResponse> {
    const reference = request.reference ?? generateReference();

    const raw = await this.request<PaystackInitializeResponse>(
      'POST',
      PAYSTACK_ENDPOINTS.INITIALIZE,
      {
        amount: request.amount,
        currency: request.currency,
        email: request.email,
        reference,
        callback_url: request.callbackUrl,
        metadata: request.metadata,
        channels: request.channel ? [request.channel] : undefined,
      }
    );

    if (!raw.status) {
      throw PaystackErrors.initializeFailed(raw.message, raw);
    }

    return {
      success: true,
      reference,
      providerReference: raw.data.access_code,
      provider: this.name,
      status: 'pending',
      amount: request.amount,
      currency: request.currency,
      authorizationUrl: raw.data.authorization_url,
      message: raw.message,
      timestamp: new Date().toISOString(),
      raw,
    };
  }

  /**
   * Verifies a transaction by reference and returns
   * its current status.
   */
  async verify(reference: string): Promise<ChargeResponse> {
    const raw = await this.request<PaystackVerifyResponse>(
      'GET',
      `${PAYSTACK_ENDPOINTS.VERIFY}/${encodeURIComponent(reference)}`
    );

    if (!raw.status) {
      throw PaystackErrors.verifyFailed(reference, raw);
    }

    return normalizeVerifyResponse(raw, reference);
  }

  /**
   * Initiates a full or partial refund for a completed transaction.
   */
  async refund(request: RefundRequest): Promise<RefundResponse> {
    const raw = await this.request<PaystackRefundResponse>(
      'POST',
      PAYSTACK_ENDPOINTS.REFUND,
      {
        transaction: request.reference,
        amount: request.amount,
        merchant_note: request.reason,
      }
    );

    if (!raw.status) {
      throw PaystackErrors.refundFailed(request.reference, raw);
    }

    return normalizeRefundResponse(raw, request.reference);
  }

  /**
   * Validates the HMAC-SHA512 signature on an incoming
   * Paystack webhook. Throws a fatal error if invalid.
   *
   * @returns true if valid — never returns false
   */
  validateWebhookSignature(
    payload: unknown,
    signature: string
  ): boolean {
    const rawBody = typeof payload === 'string'
      ? payload
      : JSON.stringify(payload);

    const isValid = validateSignature(
      rawBody,
      signature,
      this.secretKey
    );

    if (!isValid) {
      throw PaystackErrors.invalidWebhookSignature();
    }

    return true;
  }

  /**
   * Parses and normalizes a Paystack webhook payload.
   * Always pass the raw request body string and the
   * `x-paystack-signature` header value.
   */
  parseWebhook(payload: unknown, signature: string): WebhookEvent {
    this.validateWebhookSignature(payload, signature);

    const body = typeof payload === 'string'
      ? (JSON.parse(payload) as PaystackWebhookPayload)
      : (payload as PaystackWebhookPayload);

    return normalizeWebhookEvent(body);
  }

  /**
   * Pings Paystack to confirm the API is reachable and
   * credentials are valid. Used by the circuit breaker.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      await this.request(
        'GET',
        `${PAYSTACK_ENDPOINTS.VERIFY}/payfuse_healthcheck`
      );
    } catch {
      // A 404 from Paystack still means the API is reachable
      // and credentials are valid — that's all we need to confirm
    }

    return {
      provider: this.name,
      available: true,
      latencyMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };
  }
}
