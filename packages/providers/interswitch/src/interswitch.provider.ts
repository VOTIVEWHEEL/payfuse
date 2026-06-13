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
  INTERSWITCH_SANDBOX_BASE_URL,
  INTERSWITCH_PRODUCTION_BASE_URL,
  INTERSWITCH_ENDPOINTS,
  INTERSWITCH_GRANT_TYPE,
  INTERSWITCH_TOKEN_EXPIRY_SECONDS,
  INTERSWITCH_TOKEN_REFRESH_BUFFER_SECONDS,
} from './constants';
import { InterswitchErrors } from './errors';
import {
  generateReference,
  encodeBasicAuth,
  buildRequestSignature,
  validateSignature,
  normalizeQueryResponse,
  normalizeRefundResponse,
  normalizeWebhookEvent,
} from './utils';
import type {
  InterswitchEnvironment,
  InterswitchTokenResponse,
  InterswitchTokenCache,
  InterswitchPurchaseResponse,
  InterswitchQueryResponse,
  InterswitchWebhookPayload,
} from './types';

/**
 * @package @payfuse/interswitch
 * @description Interswitch provider adapter for PayFuse.
 *
 * Implements the `IPaymentProvider` interface — all public methods
 * return normalized PayFuse types. No Interswitch-specific types
 * leak outside this class.
 *
 * @example
 * ```ts
 * const interswitch = new InterswitchProvider({
 *   clientId: process.env.INTERSWITCH_CLIENT_ID!,
 *   clientSecret: process.env.INTERSWITCH_CLIENT_SECRET!,
 *   environment: 'production',
 * });
 * ```
 */
export class InterswitchProvider implements IPaymentProvider {
  readonly name: ProviderName = 'interswitch';

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly environment: InterswitchEnvironment;
  private readonly timeoutMs: number;

  /**
   * In-memory OAuth2 token cache.
   * Avoids redundant token requests by reusing valid tokens
   * until they are close to expiry.
   */
  private tokenCache: InterswitchTokenCache | null = null;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    environment: InterswitchEnvironment;
    timeoutMs?: number;
  }) {
    if (!config.clientId || !config.clientSecret) {
      throw InterswitchErrors.invalidCredentials();
    }

    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.environment = config.environment;
    this.baseUrl = config.environment === 'production'
      ? INTERSWITCH_PRODUCTION_BASE_URL
      : INTERSWITCH_SANDBOX_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  // ─── Token Management ─────────────────────────────────────────

  /**
   * Returns a valid access token, fetching a new one if the
   * cached token is missing or within the refresh buffer window.
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    const bufferMs = INTERSWITCH_TOKEN_REFRESH_BUFFER_SECONDS * 1000;

    if (
      this.tokenCache &&
      now < this.tokenCache.expiresAt - bufferMs
    ) {
      return this.tokenCache.accessToken;
    }

    return this.refreshAccessToken();
  }

  /**
   * Fetches a fresh OAuth2 access token from Interswitch
   * and stores it in the in-memory cache.
   */
  private async refreshAccessToken(): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.timeoutMs
    );

    try {
      const response = await fetch(
        `${this.baseUrl}${INTERSWITCH_ENDPOINTS.TOKEN}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${encodeBasicAuth(
              this.clientId,
              this.clientSecret
            )}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `grant_type=${INTERSWITCH_GRANT_TYPE}`,
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw InterswitchErrors.tokenFetchFailed(error);
      }

      const data = (await response.json()) as InterswitchTokenResponse;

      this.tokenCache = {
        accessToken: data.access_token,
        expiresAt:
          Date.now() + INTERSWITCH_TOKEN_EXPIRY_SECONDS * 1000,
      };

      return this.tokenCache.accessToken;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw InterswitchErrors.requestTimeout(err);
      }
      throw InterswitchErrors.tokenFetchFailed(err);
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Private HTTP Client ──────────────────────────────────────

  /**
   * Internal HTTP client for all Interswitch API calls.
   * Injects OAuth2 Bearer token and HMAC-SHA512 request
   * signature on every request.
   */
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.timeoutMs
    );

    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonce = Math.random().toString(36).substring(2);
    const requestBody = body ? JSON.stringify(body) : '';

    const signature = buildRequestSignature({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      timestamp,
      nonce,
      httpVerb: method,
      requestPath: endpoint,
      requestBody,
    });

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Timestamp: timestamp,
          Nonce: nonce,
          Signature: signature,
          SignatureMethod: 'HmacSHA512',
          AuthKeyVersion: '1',
        },
        body: requestBody || undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw InterswitchErrors.networkError(error);
      }

      return response.json() as Promise<T>;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw InterswitchErrors.requestTimeout(err);
      }
      throw InterswitchErrors.networkError(err);
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Public Interface Implementation ──────────────────────────

  /**
   * Initializes an Interswitch Webpay hosted payment and
   * returns the redirect URL for the customer to complete payment.
   */
  async charge(request: ChargeRequest): Promise<ChargeResponse> {
    const reference = request.reference ?? generateReference();

    const raw = await this.request<InterswitchPurchaseResponse>(
      'POST',
      INTERSWITCH_ENDPOINTS.PURCHASE,
      {
        customerId: request.email,
        amount: request.amount,
        transactionRef: reference,
        currency: request.currency,
        description: 'PayFuse payment',
        returnUrl: request.callbackUrl,
        metaData: request.metadata,
      }
    );

    if (!raw.redirectUrl) {
      throw InterswitchErrors.initializeFailed(raw.message, raw);
    }

    return {
      success: true,
      reference,
      providerReference: raw.paymentId,
      provider: this.name,
      status: 'pending',
      amount: request.amount,
      currency: request.currency,
      authorizationUrl: raw.redirectUrl,
      message: raw.message,
      timestamp: new Date().toISOString(),
      raw,
    };
  }

  /**
   * Queries Interswitch for the current status of a
   * transaction by reference.
   */
  async verify(reference: string): Promise<ChargeResponse> {
    const raw = await this.request<InterswitchQueryResponse>(
      'GET',
      `${INTERSWITCH_ENDPOINTS.QUERY}/${encodeURIComponent(reference)}`
    );

    if (!raw) {
      throw InterswitchErrors.verifyFailed(reference);
    }

    return normalizeQueryResponse(raw, reference);
  }

  /**
   * Initiates a refund by reversing a completed transaction.
   * Interswitch processes refunds as transaction reversals.
   */
  async refund(request: RefundRequest): Promise<RefundResponse> {
    const raw = await this.request<InterswitchQueryResponse>(
      'POST',
      `${INTERSWITCH_ENDPOINTS.QUERY}/${encodeURIComponent(request.reference)}/refund`,
      {
        amount: request.amount,
        merchantNote: request.reason,
      }
    );

    if (!raw) {
      throw InterswitchErrors.refundFailed(request.reference);
    }

    return normalizeRefundResponse(raw, request.reference);
  }

  /**
   * Validates an Interswitch webhook HMAC-SHA512 signature.
   * Throws a fatal error if the signature is invalid.
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
      this.clientSecret
    );

    if (!isValid) {
      throw InterswitchErrors.invalidWebhookSignature();
    }

    return true;
  }

  /**
   * Parses and normalizes an Interswitch webhook payload.
   * Always pass the raw request body string and the
   * `x-interswitch-signature` header value.
   */
  parseWebhook(payload: unknown, signature: string): WebhookEvent {
    this.validateWebhookSignature(payload, signature);

    const body = typeof payload === 'string'
      ? (JSON.parse(payload) as InterswitchWebhookPayload)
      : (payload as InterswitchWebhookPayload);

    return normalizeWebhookEvent(body);
  }

  /**
   * Checks Interswitch API availability by fetching a fresh
   * access token. A successful token fetch confirms both
   * reachability and credential validity.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      await this.refreshAccessToken();

      return {
        provider: this.name,
        available: true,
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        provider: this.name,
        available: false,
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
        reason: err instanceof Error
          ? err.message
          : 'Interswitch health check failed',
      };
    }
  }
}
