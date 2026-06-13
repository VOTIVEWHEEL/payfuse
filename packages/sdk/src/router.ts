import type {
  IPaymentProvider,
  RoutingStrategy,
} from '@payfuse/core';
import type { CircuitBreaker } from './circuit-breaker';

/**
 * @package @payfuse/sdk
 * @description Provider routing engine.
 *
 * Selects the next provider to attempt based on the configured
 * routing strategy, respecting circuit breaker state.
 *
 * Strategies:
 * - `priority`    → Always tries providers in ascending priority order.
 *                   Provider with priority 1 is always tried first.
 * - `round-robin` → Distributes load evenly across available providers.
 * - `cost-based`  → Reserved for future implementation.
 *                   Falls back to `priority` until implemented.
 */

export class ProviderRouter {
  private readonly strategy: RoutingStrategy;
  private readonly circuitBreaker: CircuitBreaker;

  /** Round-robin position tracker */
  private roundRobinIndex = 0;

  constructor(
    strategy: RoutingStrategy,
    circuitBreaker: CircuitBreaker
  ) {
    this.strategy = strategy;
    this.circuitBreaker = circuitBreaker;
  }

  // ─── Private Helpers ──────────────────────────────────────────

  /**
   * Filters providers to only those whose circuit is not OPEN.
   */
  private getAvailableProviders(
    providers: IPaymentProvider[]
  ): IPaymentProvider[] {
    return providers.filter((p) =>
      this.circuitBreaker.isAvailable(p.name)
    );
  }

  /**
   * Selects a provider using priority routing.
   * Providers are already sorted ascending by priority at
   * engine initialization — this picks the first available one.
   */
  private routeByPriority(
    providers: IPaymentProvider[]
  ): IPaymentProvider | null {
    const available = this.getAvailableProviders(providers);
    return available[0] ?? null;
  }

  /**
   * Selects a provider using round-robin routing.
   * Advances the index on every call, skipping unavailable providers.
   */
  private routeByRoundRobin(
    providers: IPaymentProvider[]
  ): IPaymentProvider | null {
    const available = this.getAvailableProviders(providers);

    if (!available.length) return null;

    const index = this.roundRobinIndex % available.length;
    this.roundRobinIndex = (this.roundRobinIndex + 1) % available.length;

    return available[index] ?? null;
  }

  // ─── Public API ───────────────────────────────────────────────

  /**
   * Returns the next provider to attempt based on the
   * configured routing strategy.
   *
   * Returns null if no providers are currently available
   * (all circuits open).
   */
  next(providers: IPaymentProvider[]): IPaymentProvider | null {
    switch (this.strategy) {
      case 'round-robin':
        return this.routeByRoundRobin(providers);

      case 'cost-based':
        // Cost-based routing is reserved for a future release.
        // Falls back to priority routing until implemented.
        return this.routeByPriority(providers);

      case 'priority':
      default:
        return this.routeByPriority(providers);
    }
  }

  /**
   * Returns all providers that are currently available
   * to receive traffic.
   */
  getAvailable(providers: IPaymentProvider[]): IPaymentProvider[] {
    return this.getAvailableProviders(providers);
  }
}
