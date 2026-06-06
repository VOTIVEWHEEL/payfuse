import type { ProviderName } from '@payfuse/core';

/**
 * @package @payfuse/sdk
 * @description Per-provider circuit breaker implementation.
 *
 * Tracks provider failure rates and automatically stops routing
 * traffic to unhealthy providers, giving them time to recover
 * before attempting again.
 *
 * States:
 * - CLOSED  → Normal operation. Requests pass through.
 * - OPEN    → Provider is unhealthy. Requests rejected immediately.
 * - HALF_OPEN → Testing recovery. One request allowed through.
 *
 * Transitions:
 * - CLOSED  → OPEN      : After `failureThreshold` failures in `windowMs`
 * - OPEN    → HALF_OPEN : After `resetTimeoutMs` has elapsed
 * - HALF_OPEN → CLOSED  : On successful request
 * - HALF_OPEN → OPEN    : On failed request
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of failures within `windowMs` to trip the circuit. Default: 3 */
  failureThreshold?: number;
  /** Time window in ms for counting failures. Default: 60_000 (1 min) */
  windowMs?: number;
  /** Time in ms to wait before moving OPEN → HALF_OPEN. Default: 30_000 */
  resetTimeoutMs?: number;
}

interface CircuitRecord {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
  openedAt: number | null;
}

export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly windowMs: number;
  private readonly resetTimeoutMs: number;

  /** Per-provider circuit state records */
  private readonly circuits = new Map<ProviderName, CircuitRecord>();

  constructor(config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 3;
    this.windowMs = config.windowMs ?? 60_000;
    this.resetTimeoutMs = config.resetTimeoutMs ?? 30_000;
  }

  // ─── Private Helpers ──────────────────────────────────────────

  /**
   * Returns the circuit record for a provider, creating a default
   * CLOSED record if one does not yet exist.
   */
  private getRecord(provider: ProviderName): CircuitRecord {
    if (!this.circuits.has(provider)) {
      this.circuits.set(provider, {
        state: 'CLOSED',
        failures: 0,
        lastFailureAt: 0,
        openedAt: null,
      });
    }

    return this.circuits.get(provider)!;
  }

  /**
   * Evaluates whether an OPEN circuit has waited long enough
   * to transition to HALF_OPEN.
   */
  private shouldAttemptReset(record: CircuitRecord): boolean {
    return (
      record.openedAt !== null &&
      Date.now() - record.openedAt >= this.resetTimeoutMs
    );
  }

  // ─── Public API ───────────────────────────────────────────────

  /**
   * Returns true if the provider is available to receive requests.
   * Automatically transitions OPEN → HALF_OPEN when the reset
   * timeout has elapsed.
   */
  isAvailable(provider: ProviderName): boolean {
    const record = this.getRecord(provider);

    switch (record.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        if (this.shouldAttemptReset(record)) {
          record.state = 'HALF_OPEN';
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return true;
    }
  }

  /**
   * Records a successful request for a provider.
   * Resets failure count and closes the circuit.
   */
  recordSuccess(provider: ProviderName): void {
    const record = this.getRecord(provider);

    record.state = 'CLOSED';
    record.failures = 0;
    record.openedAt = null;
  }

  /**
   * Records a failed request for a provider.
   * If failure threshold is reached, opens the circuit.
   */
  recordFailure(provider: ProviderName): void {
    const record = this.getRecord(provider);
    const now = Date.now();

    // Reset failure count if outside the tracking window
    if (now - record.lastFailureAt > this.windowMs) {
      record.failures = 0;
    }

    record.failures += 1;
    record.lastFailureAt = now;

    if (
      record.state === 'HALF_OPEN' ||
      record.failures >= this.failureThreshold
    ) {
      record.state = 'OPEN';
      record.openedAt = now;
    }
  }

  /**
   * Returns the current circuit state for a provider.
   * Useful for monitoring and debugging.
   */
  getState(provider: ProviderName): CircuitState {
    return this.getRecord(provider).state;
  }

  /**
   * Forcefully resets a provider's circuit to CLOSED.
   * Use sparingly — only for manual recovery operations.
   */
  reset(provider: ProviderName): void {
    this.circuits.delete(provider);
  }
}
