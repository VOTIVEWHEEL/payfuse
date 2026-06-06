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
  MTN_MOMO_SANDBOX_BASE_URL,
  MTN_MOMO_PRODUCTION_BASE_URL,
  MTN_MOMO_ENDPOINTS,
  MTN_PARTY_ID_TYPE,
  MTN_TOKEN_EXPIRY_SECONDS,
  MTN_TOKEN_REFRESH_BUFFER_SECONDS,
} from './constants';
import { MtnMomoErrors } from './errors';
import {
  generateReference,
  validateSignature,
  encodeBasicAuth,
  normalizeStatusResponse,
  normalizeWebhookEvent,
} from './utils';
import type {
  MtnEnvironment,
  MtnTokenResponse,
  MtnTokenCache,
  MtnRequestToPayStatus,
  MtnWebhookPayload,
} from './types';

/**
 * @package @payfuse/mtn-momo
 * @description MTN MoMo provider adapter for PayFuse.
 *
 * Implements the `IPaymentProvider` interface — all public methods
 * return normalized PayFuse types. No MTN MoMo-specific types
 * leak outside this class.
 *
 * IMPORTANT DIFFERENCES FROM OTHER PROVIDERS:
 * - Payments are async push (USSD prompt sent to customer's phone)
 * - `charge()` returns status: 'pending' — always poll `verify()` for final status
 * - `phoneNumber` on ChargeRequest is REQUIRED
 * - `refund()` is not supported via Collections API — throws a fatal error
 * - Uses OAuth2 Bearer tokens that expire after 1 hour (auto-refreshed internally)
 *
 * @example
 * ```ts
 * const mtnMomo = new MtnMomoProvider({
 *   apiUserId: process.env.MTN_API_USER_ID!,
 *   apiKey: process.env.MTN_API_KEY!,
 *   subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY!,
 *   environment: 'production',
 * });
 * ```
 */
export class MtnMomoProvider implements IPaymentProvider {
  readonly name: ProviderName = 'mtn-momo';

  private readonly apiUserId: string;
  private readonly apiKey: string;
  private readonly subscriptionKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;
  private readonly environment: MtnEnvironment;
  private readonly timeoutMs: number;

  /**
   * In-memory OAuth2 token cache.
   * Avoids redundant token requests by reusing valid tokens
   * until they are close to expiry.
   */
  private tokenCache: MtnTokenCache | null = null;

  constructor(config: {
    apiUserId: string;
    apiKey: string;
    subscriptionKey: string;
    /**
     * Your MTN MoMo API secret — used to validate webhook signatures.
     * Find this in your MTN MoMo developer portal.
     */
    apiSecret: string;
    environment: MtnEnvironment;
    timeoutMs?: number;
  }) {
    if (!config.apiUserId || !config.apiKey || !config.subscriptionKey) {
      throw MtnMomoErrors.invalidCredentials();
    }

    this.apiUserId = config.apiUserId;
    this.apiKey = config.apiKey;
    this.subscriptionKey = config.subscriptionKey;
    this.apiSecret = config.apiSecret;
    this.environment = config.environment;
    this.baseUrl = config.environment === 'production'
      ? MTN_MOMO_PRODUCTION_BASE_URL
      : MTN_MOMO_SANDBOX_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  // ─── Token Management ─────────────────────────────────────────

  /**
   * Returns a valid access token, fetching a new one if the
   * cached token is missing or within the refresh buffer window.
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    const bufferMs = MTN_TOKEN_REFRESH_BUFFER_SECONDS * 1000;

    if (
      this.tokenCache &&
      now < this.tokenCache.expiresAt - bufferMs
    ) {
      return this.tokenCache.accessToken;
    }

    return this.refreshAccessToken();
  }

  /**
   * Fetches a fresh OAuth2 access token from MTN MoMo
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
        `${this.baseUrl}${MTN_MOMO_ENDPOINTS.TOKEN}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${encodeBasicAuth(
              this.apiUserId,
              this.apiKey
            )}`,
            'Ocp-Apim-Subscription-Key': this.subscriptionKey,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw MtnMomoErrors.tokenFetchFailed(error);
      }

      const data = (await response.json()) as MtnTokenResponse;

      this.tokenCache = {
        accessToken: data.access_token,
        expiresAt: Date.now() + MTN_TOKEN_EXPIRY_SECONDS * 1000,
      };

      return this.tokenCache.accessToken;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw MtnMomoErrors.requestTimeout(err);
      }
      throw MtnMomoErrors.tokenFetchFailed(err);
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Private HTTP Client ──────────────────────────────────────

  /**
   * Internal HTTP client for all MTN MoMo API calls.
   * Automatically injects the OAuth2 Bearer token and
   * the required Ocp-Apim-Subscription-Key header.
   */
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    options: {
      body?: Record<string, unknown>;
      referenceId?: string;
    } = {}
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.timeoutMs
    );

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'X-Target-Environment': this.environment,
        'Content-Type': 'application/json',
      };

      if (options.referenceId) {
        headers['X-Reference-Id'] = options.referenceId;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: options.body
          ? JSON.stringify(options.body)
          : undefined,
        signal: controller.signal,
      });

      // MTN MoMo returns 202 Accepted for async operations —
      // this is a success, not an error
      if (response.status === 202) {
        return {} as T;
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw MtnMomoErrors.networkError(error);
      }

      return response.json() as Promise<T>;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw MtnMomoErrors.requestTimeout(err);
      }
      throw MtnMomoErrors.networkError(err);
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Public Interface Implementation ──────────────────────────

  /**
   * Initiates a Request to Pay — sends a USSD payment prompt
   * to the customer's phone number.
   *
   * Always returns status: 'pending'. The payment is async.
   * Poll `verify(reference)` to get the final status.
   *
   * REQUIRES: `request.phoneNumber` in E.164 format (+2348012345678)
   */
  async charge(request: ChargeRequest): Promise<ChargeResponse> {
    if (!request.phoneNumber) {
      throw MtnMomoErrors.missingPhoneNumber();
    }

    const reference = request.reference ?? generateReference();

    await this.request<void>(
      'POST',
      MTN_MOMO_ENDPOINTS.REQUEST_TO_PAY,
      {
        referenceId: reference,
        body: {
          amount: String(request.amount),
          currency: request.currency,
          externalId: reference,
          payer: {
            partyIdType: MTN_PARTY_ID_TYPE,
            partyId: request.phoneNumber.replace('+', ''),
          },
          payerMessage: 'Payment via PayFuse',
          payeeNote: 'PayFuse transaction',
        },
      }
    );

    return {
      success: true,
      reference,
      providerReference: reference,
      provider: this.name,
      status: 'pending',
      amount: request.amount,
      currency: request.currency,
      message: 'Payment request sent to customer phone. Poll verify() for final status.',
      timestamp: new Date().toISOString(),
      raw: { reference },
    };
  }

  /**
   * Checks the current status of a Request to Pay by reference.
   * Use this to poll for the final SUCCESSFUL or FAILED status
   * after initiating a charge.
   */
  async verify(reference: string): Promise<ChargeResponse> {
    const raw = await this.request<MtnRequestToPayStatus>(
      'GET',
      `${MTN_MOMO_ENDPOINTS.REQUEST_TO_PAY_STATUS}/${encodeURIComponent(reference)}`
    );

    if (!raw) {
      throw MtnMomoErrors.verifyFailed(reference);
    }

    return normalizeStatusResponse(raw, reference);
  }

  /**
   * MTN MoMo Collections does not support refunds.
   * To reverse funds, use the MTN MoMo Disbursements product
   * directly via your MTN developer portal.
   *
   * This method always throws a fatal error.
   */
  async refund(_request: RefundRequest): Promise<RefundResponse> {
    throw MtnMomoErrors.refundNotSupported();
  }

  /**
   * Validates an MTN MoMo webhook HMAC-SHA256 signature.
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
      this.apiSecret
    );

    if (!isValid) {
      throw MtnMomoErrors.invalidWebhookSignature();
    }

    return true;
  }

  /**
   * Parses and normalizes an MTN MoMo webhook payload.
   * Pass the raw request body string and the signature header value.
   */
  parseWebhook(payload: unknown, signature: string): WebhookEvent {
    this.validateWebhookSignature(payload, signature);

    const body = typeof payload === 'string'
      ? (JSON.parse(payload) as MtnWebhookPayload)
      : (payload as MtnWebhookPayload);

    return normalizeWebhookEvent(body);
  }

  /**
   * Checks MTN MoMo API availability by fetching a fresh
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
          : 'MTN MoMo health check failed',
      };
    }
  }
}
