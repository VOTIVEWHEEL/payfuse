/**
 * @package @payfuse/core
 * @description Unified type contracts for all PayFuse provider adapters.
 * All providers MUST conform to these types — no provider-specific
 * types should leak outside their own package.
 */

// ─── Provider Registry ────────────────────────────────────────────────────────

/** Canonical identifiers for all supported payment providers. */
export type ProviderName =
  | 'paystack'
  | 'flutterwave'
  | 'mtn-momo'
  | 'interswitch'
  | 'opay';

// ─── Currency ─────────────────────────────────────────────────────────────────

/** ISO 4217 currency codes supported by PayFuse. */
export type Currency =
  | 'NGN'
  | 'GHS'
  | 'KES'
  | 'ZAR'
  | 'USD';

// ─── Payment Channel ──────────────────────────────────────────────────────────

/** The method through which a payment is initiated. */
export type PaymentChannel =
  | 'card'
  | 'bank_transfer'
  | 'mobile_money'
  | 'ussd'
  | 'qr';

// ─── Transaction Status ───────────────────────────────────────────────────────

/** Normalized transaction lifecycle states across all providers. */
export type ChargeStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'abandoned'
  | 'reversed';

// ─── Error Severity ───────────────────────────────────────────────────────────

export type ErrorSeverity = 'retryable' | 'fatal';

// ─── PayFuse Error ────────────────────────────────────────────────────────────

/**
 * Structured error type for all PayFuse operations.
 * Use this instead of raw Error objects to ensure consistent
 * error handling across consumers.
 */
export interface PayFuseError {
  /** Machine-readable error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** The provider that produced this error, if applicable */
  provider?: ProviderName;
  /** Whether the operation can be safely retried */
  severity: ErrorSeverity;
  /** Original error from the provider SDK or HTTP client */
  cause?: unknown;
}

// ─── Charge Request ───────────────────────────────────────────────────────────

/**
 * Unified input for initiating a charge across any provider.
 *
 * IMPORTANT: `amount` must always be in the smallest currency unit.
 * e.g. NGN 500 = 50000 kobo, GHS 10 = 1000 pesewas
 */
export interface ChargeRequest {
  /** Amount in smallest currency unit (kobo, pesewas, etc.) */
  amount: number;
  currency: Currency;
  /** Customer email — required by most providers for receipts/identity */
  email: string;
  /**
   * Customer phone number in E.164 format (+2348012345678).
   * Required for mobile_money channel (e.g. MTN MoMo).
   */
  phoneNumber?: string;
  /**
   * Unique transaction reference. Auto-generated (UUID v4) if omitted.
   * Must be unique per transaction across your system.
   */
  reference?: string;
  /** URL provider redirects to after payment authorization */
  callbackUrl?: string;
  /** Payment channel preference. Provider will use its default if omitted. */
  channel?: PaymentChannel;
  /** Arbitrary key-value pairs passed through to the provider */
  metadata?: Record<string, unknown>;
}

// ─── Charge Response ──────────────────────────────────────────────────────────

/**
 * Unified output from a charge operation.
 * The `raw` field always holds the unmodified provider response
 * for audit and debugging purposes.
 */
export interface ChargeResponse {
  success: boolean;
  /** Your system's transaction reference */
  reference: string;
  /** The provider's own transaction identifier */
  providerReference: string;
  provider: ProviderName;
  status: ChargeStatus;
  /** Amount in smallest currency unit */
  amount: number;
  currency: string;
  /**
   * Redirect URL for hosted/redirect payment flows.
   * Present when the provider requires the customer to
   * complete payment on an external page.
   */
  authorizationUrl?: string;
  message: string;
  /** ISO 8601 timestamp of when the response was received */
  timestamp: string;
  /** Unmodified provider response — never omit, always preserve */
  raw: unknown;
}

// ─── Refund ───────────────────────────────────────────────────────────────────

/**
 * Input for initiating a full or partial refund.
 * `amount` is optional — if omitted, a full refund is assumed.
 */
export interface RefundRequest {
  /** The original transaction reference to refund */
  reference: string;
  /** Partial refund amount in smallest currency unit. Full refund if omitted. */
  amount?: number;
  /** Reason for the refund — stored for audit trail */
  reason?: string;
  metadata?: Record<string, unknown>;
}

/** Normalized response from a refund operation. */
export interface RefundResponse {
  success: boolean;
  refundReference: string;
  originalReference: string;
  provider: ProviderName;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed';
  message: string;
  timestamp: string;
  raw: unknown;
}

// ─── Webhook Event ────────────────────────────────────────────────────────────

/**
 * Normalized webhook payload from any provider.
 * Raw provider webhooks are parsed into this shape by each adapter's
 * `parseWebhook()` method, ensuring consumers never need
 * provider-specific logic.
 */
export interface WebhookEvent {
  provider: ProviderName;
  /** The provider's event name, normalized to lowercase dot-notation */
  event: string;
  reference: string;
  amount: number;
  currency: string;
  status: ChargeStatus;
  /** ISO 8601 timestamp from the provider event */
  timestamp: string;
  metadata?: Record<string, unknown>;
  /** Unmodified provider webhook payload */
  raw: unknown;
}

// ─── Health Check ─────────────────────────────────────────────────────────────

/** Result of a provider availability check used by the circuit breaker. */
export interface HealthCheckResult {
  provider: ProviderName;
  available: boolean;
  latencyMs?: number;
  checkedAt: string;
  reason?: string;
}

// ─── Provider Config ──────────────────────────────────────────────────────────

/**
 * Per-provider configuration passed into PayFuse at initialization.
 * Credentials are typed as `Record<string, string>` because each
 * provider requires different keys. Each adapter documents and
 * validates its own required credential keys.
 */
export interface ProviderConfig {
  name: ProviderName;
  /**
   * Routing priority. Lower number = higher priority.
   * e.g. priority 1 is tried before priority 2.
   */
  priority: number;
  enabled: boolean;
  credentials: Record<string, string>;
}

// ─── Routing Strategy ─────────────────────────────────────────────────────────

/**
 * Strategy used by the orchestration engine to select a provider.
 * - `priority`: Always attempts in order of `ProviderConfig.priority`
 * - `round-robin`: Distributes load evenly across enabled providers
 * - `cost-based`: Selects cheapest provider for the currency/amount (future)
 */
export type RoutingStrategy =
  | 'priority'
  | 'round-robin'
  | 'cost-based';

// ─── PayFuse Config ───────────────────────────────────────────────────────────

/** Top-level configuration for the PayFuse orchestration engine. */
export interface PayFuseConfig {
  providers: ProviderConfig[];
  /** Defaults to `priority` */
  strategy?: RoutingStrategy;
  /** Number of provider failover attempts before throwing. Defaults to 2. */
  retries?: number;
  /** Per-request timeout in milliseconds. Defaults to 30000. */
  timeout?: number;
}
