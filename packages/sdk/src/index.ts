/**
 * @package @payfuse/sdk
 * @description PayFuse unified payment orchestration SDK.
 *
 * This is the primary entry point for consuming PayFuse.
 * Import everything you need from here.
 *
 * @example
 * ```ts
 * import {
 *   PayFuseEngine,
 *   PaystackProvider,
 *   FlutterwaveProvider,
 * } from '@payfuse/sdk';
 *
 * const payfuse = new PayFuseEngine({
 *   providers: [
 *     { name: 'paystack', priority: 1, enabled: true, credentials: {} },
 *     { name: 'flutterwave', priority: 2, enabled: true, credentials: {} },
 *   ],
 *   strategy: 'priority',
 *   retries: 2,
 * });
 *
 * payfuse
 *   .register(new PaystackProvider({ secretKey: process.env.PAYSTACK_SECRET_KEY! }))
 *   .register(new FlutterwaveProvider({
 *     secretKey: process.env.FLW_SECRET_KEY!,
 *     secretHash: process.env.FLW_SECRET_HASH!,
 *   }));
 *
 * const result = await payfuse.charge({
 *   amount: 50000,
 *   currency: 'NGN',
 *   email: 'customer@example.com',
 * });
 * ```
 */

// ─── Core Engine ──────────────────────────────────────────────
export { PayFuseEngine } from './engine';
export type { AllProvidersExhaustedError } from './engine';

// ─── Internal Modules (for advanced use) ──────────────────────
export { CircuitBreaker } from './circuit-breaker';
export type { CircuitBreakerConfig } from './circuit-breaker';
export { ProviderRouter } from './router';
export { withRetry } from './retry';
export type { RetryConfig } from './retry';

// ─── Provider Adapters ────────────────────────────────────────
export { PaystackProvider } from '@payfuse/paystack';
export { FlutterwaveProvider } from '@payfuse/flutterwave';
export { MtnMomoProvider } from '@payfuse/mtn-momo';
export { InterswitchProvider } from '@payfuse/interswitch';
export { OpayProvider } from '@payfuse/opay';

// ─── Core Types (re-exported for consumer convenience) ────────
export type {
  ProviderName,
  Currency,
  PaymentChannel,
  ChargeStatus,
  ChargeRequest,
  ChargeResponse,
  RefundRequest,
  RefundResponse,
  WebhookEvent,
  HealthCheckResult,
  PayFuseError,
  PayFuseConfig,
  ProviderConfig,
  RoutingStrategy,
} from '@payfuse/core';
