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
  OPAY_SANDBOX_BASE_URL,
  OPAY_PRODUCTION_BASE_URL,
  OPAY_ENDPOINTS,
  OPAY_SUCCESS_CODE,
  OPAY_DEFAULT_EXPIRY_MINUTES,
} from './constants';
import { OpayErrors } from './errors';
import {
  generateReference,
  buildSignature,
  validateSignature,
  buildExpiryTime,
  normalizeQueryResponse,
  normalizeRefundResponse,
  normalizeWebhookEvent,
} from './utils';
import type {
  OpayEnvironment,
  OpayBaseResponse,
  OpayCashierCreateData,
  OpayCashierQueryData,
  OpayRefundData,
  OpayWebhookPayload,
} from './types';

/**
 * @package @payfuse/opay
 * @description OPay provider adapter for PayFuse.
 *
 * Implements the `IPaymentProvider` interface — all public methods
 * return normalized PayFuse types. No OPay-specific types
 * leak outside this class.
 *
 * @example
 * ```ts
 * const opay = new OpayProvider({
 *   merchantId: process.env.OPAY_MERCHANT_ID!,
 *   appSecret: process.env.OPAY_APP_SECRET!,
 *   environment: 'production',
 * });
 * ```
 */
export class OpayProvider implements IPaymentProvider {
  readonly name: ProviderName = 'opay';

  private readonly merchantId: string;
  private readonly appSecret: string;
  private readonly baseUrl: string;
  private readonly environment: OpayEnvironment;
  private readonly timeoutMs: number;

  constructor(config: {
    merchantId: string;
    appSecret: string;
    environment: OpayEnvironment;
    timeoutMs?: number;
  }) {
    if (!config.merchantId || !config.appSecret) {
      throw OpayErrors.invalidCredentials();
    }

    this.merchantId = config.merchantId;
    this.appSecret = config.appSecret;
    this.environment = config.environment;
    this.baseUrl = config.environment === 'production'
      ? OPAY_PRODUCTION_BASE_URL
      : OPAY_SANDBOX_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  // ─── Private HTTP Client ──────────────────────────────────────

  /**
   * Internal HTTP client for all OPay API calls.
   * Automatically computes and injects the HMAC-SHA512
   * signature and MerchantId on every request.
   */
  private async request<T>(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<OpayBaseResponse<T>> {
    const signature = buildSignature(body, this.appSecret);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.timeoutMs
    );

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${signature}`,
          MerchantId: this.merchantId,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw OpayErrors.networkError(error);
      }

      return response.json() as Promise<OpayBaseResponse<T>>;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw OpayErrors.requestTimeout(err);
      }
      throw OpayErrors.networkError(err);
    } finally {
      clearTimeout(timer);
    }
  }

  // ─── Public Interface Implementation ──────────────────────────

  /**
   * Initializes an OPay Cashier hosted payment and returns
   * the checkout URL for the customer to complete payment.
   */
  async charge(request: ChargeRequest): Promise<ChargeResponse> {
    const reference = request.reference ?? generateReference();

    const raw = await this.request<OpayCashierCreateData>(
      OPAY_ENDPOINTS.CASHIER_CREATE,
      {
        reference,
        merchantId: this.merchantId,
        amount: request.amount,
        currency: request.currency,
        country: 'NG',
        callbackUrl: request.callbackUrl ?? '',
        returnUrl: request.callbackUrl ?? '',
        cancelUrl: request.callbackUrl ?? '',
        expireAt: buildExpiryTime(OPAY_DEFAULT_EXPIRY_MINUTES),
        userInfo: {
          userId: request.email,
          userName: request.email,
          userEmail: request.email,
          userMobile: request.phoneNumber,
        },
        productList: [
          {
            id: reference,
            name: 'PayFuse Payment',
            description: 'Payment via PayFuse',
            price: request.amount,
            quantity: 1,
          },
        ],
      }
    );

    if (raw.code !== OPAY_SUCCESS_CODE) {
      throw OpayErrors.initializeFailed(raw.message, raw);
    }

    return {
      success: true,
      reference,
      providerReference: raw.data.orderNo,
      provider: this.name,
      status: 'pending',
      amount: request.amount,
      currency: request.currency,
      authorizationUrl: raw.data.cashierUrl,
      message: raw.message,
      timestamp: new Date().toISOString(),
      raw,
    };
  }

  /**
   * Queries OPay for the current status of a transaction
   * by reference.
   */
  async verify(reference: string): Promise<ChargeResponse> {
    const raw = await this.request<OpayCashierQueryData>(
      OPAY_ENDPOINTS.CASHIER_QUERY,
      {
        reference,
        merchantId: this.merchantId,
      }
    );

    if (raw.code !== OPAY_SUCCESS_CODE) {
      throw OpayErrors.verifyFailed(reference, raw);
    }

    return normalizeQueryResponse(raw.data, reference);
  }

  /**
   * Initiates a full or partial refund for a completed
   * OPay transaction.
   */
  async refund(request: RefundRequest): Promise<RefundResponse> {
    const raw = await this.request<OpayRefundData>(
      OPAY_ENDPOINTS.CASHIER_REFUND,
      {
        reference: request.reference,
        merchantId: this.merchantId,
        refundAmount: request.amount,
        reason: request.reason ?? 'Refund requested via PayFuse',
      }
    );

    if (raw.code !== OPAY_SUCCESS_CODE) {
      throw OpayErrors.refundFailed(request.reference, raw);
    }

    return normalizeRefundResponse(raw.data, request.reference);
  }

  /**
   * Validates an OPay webhook HMAC-SHA512 signature.
   * Throws a fatal error if the signature is invalid.
   *
   * @returns true if valid — never returns false
   */
  validateWebhookSignature(
    payload: unknown,
    signature: string
  ): boolean {
    const body = typeof payload === 'string'
      ? (JSON.parse(payload) as Record<string, unknown>)
      : (payload as Record<string, unknown>);

    const isValid = validateSignature(body, signature, this.appSecret);

    if (!isValid) {
      throw OpayErrors.invalidWebhookSignature();
    }

    return true;
  }

  /**
   * Parses and normalizes an OPay webhook payload.
   * Always pass the raw request body and the `sign` header value.
   */
  parseWebhook(payload: unknown, signature: string): WebhookEvent {
    this.validateWebhookSignature(payload, signature);

    const body = typeof payload === 'string'
      ? (JSON.parse(payload) as OpayWebhookPayload)
      : (payload as OpayWebhookPayload);

    return normalizeWebhookEvent(body);
  }

  /**
   * Checks OPay API availability by sending a query with a
   * known-invalid reference. Any structured response confirms
   * the API is reachable and credentials are valid.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();

    try {
      await this.request(OPAY_ENDPOINTS.CASHIER_QUERY, {
        reference: 'payfuse_healthcheck',
        merchantId: this.merchantId,
      });

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
          : 'OPay health check failed',
      };
    }
  }
}
