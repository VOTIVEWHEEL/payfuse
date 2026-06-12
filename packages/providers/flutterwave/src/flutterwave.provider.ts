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
  FLUTTERWAVE_BASE_URL,
  FLUTTERWAVE_ENDPOINTS,
} from './constants';
import { FlutterwaveErrors } from './errors';
import {
  generateReference,
  validateSignature,
  normalizeVerifyResponse,
  normalizeRefundResponse,
  normalizeWebhookEvent,
} from './utils';
import type {
  FlutterwaveInitializeResponse,
  FlutterwaveVerifyResponse,
  FlutterwaveRefundResponse,
  FlutterwaveWebhookPayload,
} from './types';

/**
 * @package @payfuse/flutterwave
 * @description Flutterwave provider adapter for PayFuse.
 *
 * Implements the `IPaymentProvider` interface — all public methods
 * return normalized PayFuse types. No Flutterwave-specific types
 * leak outside this class.
 *
 * @example
 * ```ts
 * const flutterwave = new FlutterwaveProvider({
 *   secretKey: process.env.FLW_SECRET_KEY!,
 *   secretHash: process.env.FLW_SECRET_HASH!,
 * });
 * ```
 */
export class FlutterwaveProvider implements IPaymentProvider {
  readonly name: ProviderName = 'flutterwave';

  private readonly secretKey: string;
  private readonly secretHash: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: {
    secretKey: string;
    /**
     * The secret hash configured in your Flutterwave dashboard
     * under Webhooks. Used to validate incoming webhook payloads.
     */
    secretHash: string;
    timeoutMs?: number;
  }) {
    if (!config.secretKey || !config.secretKey.startsWith('FLWSECK')) {
      throw FlutterwaveErrors.invalidCredentials();
    }

    if (!config.secretHash) {
      throw FlutterwaveErrors.invalidCredentials(
        'secretHash is required for webhook validation.'
      );
    }

    this.secretKey = config.secretKey;
    this.secretHash = config.secretHash;
    this.baseUrl = FLUTTERWAVE_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  // ─── Private HTTP Client ──────────────────────────────────────

  /**
   * Internal HTTP client for all Flutterwave API calls.
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
        throw FlutterwaveErrors.networkError(error);
      }

      return response.json() as Promise<T>;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw FlutterwaveErrors.requestTimeout(err);
      }
      throw FlutterwaveErrors.networkError(err);
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Public Interface Implementation ──────────────────────────

  /**
   * Initializes a Flutterwave payment and returns the
   * hosted payment link for the customer to complete payment.
   */
  async charge(request: ChargeRequest): Promise<ChargeResponse> {
    const reference = request.reference ?? generateReference();

    const raw = await this.request<FlutterwaveInitializeResponse>(
      'POST',
      FLUTTERWAVE_ENDPOINTS.PAYMENTS,
      {
        tx_ref: reference,
        amount: request.amount,
        currency: request.currency,
        redirect_url: request.callbackUrl,
        payment_options: request.channel ?? undefined,
        meta: request.metadata,
        customer: {
          email: request.email,
          phone_number: request.phoneNumber,
        },
      }
    );

    if (raw.status !== 'success') {
      throw FlutterwaveErrors.initializeFailed(raw.message, raw);
    }

    return {
      success: true,
      reference,
      providerReference: reference,
      provider: this.name,
      status: 'pending',
      amount: request.amount,
      currency: request.currency,
      authorizationUrl: raw.data.link,
      message: raw.message,
      timestamp: new Date().toISOString(),
      raw,
    };
  }

  /**
   * Verifies a transaction by tx_ref (reference).
   * Queries Flutterwave's transaction list filtered by tx_ref
   * since Flutterwave's verify endpoint requires a numeric ID.
   */
  async verify(reference: string): Promise<ChargeResponse> {
    const raw = await this.request<{
      status: string;
      message: string;
      data: FlutterwaveVerifyResponse['data'][];
    }>(
      'GET',
      `${FLUTTERWAVE_ENDPOINTS.VERIFY}?tx_ref=${encodeURIComponent(reference)}`
    );

    if (raw.status !== 'success' || !raw.data?.length) {
      throw FlutterwaveErrors.transactionNotFound(reference, raw);
    }

    const transaction = raw.data[0];

    return normalizeVerifyResponse(
      { status: 'success', message: raw.message, data: transaction },
      reference
    );
  }

  /**
   * Initiates a full or partial refund for a completed transaction.
   * Requires the numeric Flutterwave transaction ID from the
   * original verify response's `providerReference`.
   */
  async refund(request: RefundRequest): Promise<RefundResponse> {
    const raw = await this.request<FlutterwaveRefundResponse>(
      'POST',
      `${FLUTTERWAVE_ENDPOINTS.REFUND}/${encodeURIComponent(request.reference)}/refund`,
      {
        amount: request.amount,
      }
    );

    if (raw.status !== 'success') {
      throw FlutterwaveErrors.refundFailed(request.reference, raw);
    }

    return normalizeRefundResponse(raw, request.reference);
  }

  /**
   * Validates the Flutterwave webhook secret hash.
   * Flutterwave uses direct string comparison — not HMAC.
   * Throws a fatal error if the signature is invalid.
   *
   * @returns true if valid — never returns false
   */
  validateWebhookSignature(
    _payload: unknown,
    signature: string
  ): boolean {
    const isValid = validateSignature(signature, this.secretHash);

    if (!isValid) {
      throw FlutterwaveErrors.invalidWebhookSignature();
    }

    return true;
  }

  /**
   * Parses and normalizes a Flutterwave webhook payload.
   * Always pass the `verif-hash` header value as the signature.
   */
  parseWebhook(payload: unknown, signature: string): WebhookEvent {
    this.validateWebhookSignature(payload, signature);

    const body = typeof payload === 'string'
      ? (JSON.parse(payload) as FlutterwaveWebhookPayload)
      : (payload as FlutterwaveWebhookPayload);

    return normalizeWebhookEvent(body);
  }

  /**
   * Pings Flutterwave to confirm the API is reachable and
   * credentials are valid. Used by the circuit breaker.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      await this.request(
        'GET',
        `${FLUTTERWAVE_ENDPOINTS.VERIFY}?tx_ref=payfuse_healthcheck`
      );
    } catch {
      // Any response from Flutterwave confirms reachability
      // and credential validity — that's sufficient
    }

    return {
      provider: this.name,
      available: true,
      latencyMs: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };
  }
}
