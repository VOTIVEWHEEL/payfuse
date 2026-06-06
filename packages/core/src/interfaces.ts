import type {
  ChargeRequest,
  ChargeResponse,
  WebhookEvent,
  RefundRequest,
  RefundResponse,
  HealthCheckResult,
  ProviderName,
} from './types';

/**
 * Contract that every PayFuse provider adapter must implement.
 *
 * No adapter may add public methods outside this interface.
 * Provider-specific behaviour belongs in private methods only.
 */
export interface IPaymentProvider {
  /** The canonical provider identifier */
  readonly name: ProviderName;

  /**
   * Initiate a charge against this provider.
   * Must throw a `PayFuseError` on failure — never return
   * a failed response silently.
   */
  charge(request: ChargeRequest): Promise<ChargeResponse>;

  /**
   * Verify the current status of a transaction by reference.
   * Used for polling and post-webhook confirmation.
   */
  verify(reference: string): Promise<ChargeResponse>;

  /**
   * Initiate a full or partial refund on a completed transaction.
   */
  refund(request: RefundRequest): Promise<RefundResponse>;

  /**
   * Parse and normalize a raw provider webhook payload into a
   * `WebhookEvent`. Must validate the webhook signature before
   * returning — throw on invalid signatures.
   *
   * @param payload - The raw request body from the provider
   * @param signature - The signature header value sent by the provider
   */
  parseWebhook(payload: unknown, signature: string): WebhookEvent;

  /**
   * Validate that the provided webhook signature is authentic.
   * Security-critical. Must throw on invalid signatures.
   *
   * @returns true if valid — never returns false (throws instead)
   */
  validateWebhookSignature(payload: unknown, signature: string): boolean;

  /**
   * Check provider availability. Used by the circuit breaker to
   * determine whether to route traffic to this provider.
   */
  healthCheck(): Promise<HealthCheckResult>;
}
