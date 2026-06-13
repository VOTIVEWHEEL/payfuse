import type {
  IPaymentProvider,
  ChargeRequest,
  ChargeResponse,
  RefundRequest,
  RefundResponse,
  WebhookEvent,
  HealthCheckResult,
  PayFuseConfig,
  PayFuseError,
  ProviderName,
} from '@payfuse/core';
import { CircuitBreaker } from './circuit-breaker';
import { ProviderRouter } from './router';
import { withRetry } from './retry';

/**
 * @package @payfuse/sdk
 * @description PayFuse orchestration engine.
 *
 * The central class that ties together provider routing,
 * circuit breaking, and retry logic into a single
 * fault-tolerant payment interface.
 *
 * Usage:
 * ```ts
 * const payfuse = new PayFuseEngine(config);
 *
 * payfuse.register(new PaystackProvider({ secretKey: '...' }));
 * payfuse.register(new FlutterwaveProvider({ secretKey: '...', secretHash: '...' }));
 *
 * const result = await payfuse.charge({
 *   amount: 50000,
 *   currency: 'NGN',
 *   email: 'customer@example.com',
 * });
 * ```
 */

/**
 * Structured error thrown when all providers have been
 * exhausted without a successful response.
 */
export interface AllProvidersExhaustedError extends PayFuseError {
  code: 'ALL_PROVIDERS_EXHAUSTED';
  attemptedProviders: ProviderName[];
}

export class PayFuseEngine {
  private readonly config: Required<PayFuseConfig>;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly router: ProviderRouter;

  /**
   * Registered providers sorted ascending by priority.
   * Lower priority number = higher routing preference.
   */
  private providers: IPaymentProvider[] = [];

  constructor(config: PayFuseConfig) {
    this.config = {
      providers: config.providers,
      strategy: config.strategy ?? 'priority',
      retries: config.retries ?? 2,
      timeout: config.timeout ?? 30_000,
    };

    this.circuitBreaker = new CircuitBreaker();
    this.router = new ProviderRouter(
      this.config.strategy,
      this.circuitBreaker
    );
  }

  // ─── Provider Registration ────────────────────────────────────

  /**
   * Registers a provider adapter with the engine.
   * Providers are automatically sorted by their configured
   * priority after each registration.
   *
   * Only providers present in `config.providers` and marked
   * `enabled: true` are accepted.
   */
  register(provider: IPaymentProvider): this {
    const providerConfig = this.config.providers.find(
      (p) => p.name === provider.name
    );

    if (!providerConfig) {
      throw {
        code: 'PROVIDER_NOT_CONFIGURED',
        message: `Provider '${provider.name}' is not in PayFuse config. ` +
          `Add it to the providers array before registering.`,
        severity: 'fatal',
      } satisfies PayFuseError;
    }

    if (!providerConfig.enabled) {
      return this;
    }

    this.providers.push(provider);

    // Re-sort by priority after each registration
    this.providers.sort((a, b) => {
      const priorityA = this.config.providers.find(
        (p) => p.name === a.name
      )?.priority ?? 999;
      const priorityB = this.config.providers.find(
        (p) => p.name === b.name
      )?.priority ?? 999;
      return priorityA - priorityB;
    });

    return this;
  }

  // ─── Private Helpers ──────────────────────────────────────────

  /**
   * Executes an operation across providers with automatic
   * failover. Tries each available provider in routing order.
   * Records circuit breaker success/failure after each attempt.
   */
  private async withFailover<T>(
    operation: (provider: IPaymentProvider) => Promise<T>
  ): Promise<T> {
    const attempted: ProviderName[] = [];
    const available = [...this.providers];

    while (true) {
      const provider = this.router.next(
        available.filter((p) => !attempted.includes(p.name))
      );

      if (!provider) {
        break;
      }

      attempted.push(provider.name);

      try {
        const result = await withRetry(
          () => operation(provider),
          { maxRetries: this.config.retries }
        );

        this.circuitBreaker.recordSuccess(provider.name);
        return result;
      } catch (error: unknown) {
        this.circuitBreaker.recordFailure(provider.name);

        // Fatal errors skip failover — throw immediately
        const isFatal =
          typeof error === 'object' &&
          error !== null &&
          'severity' in error &&
          (error as PayFuseError).severity === 'fatal';

        if (isFatal) throw error;

        // Continue to next provider
        continue;
      }
    }

    // All providers exhausted
    const exhaustedError: AllProvidersExhaustedError = {
      code: 'ALL_PROVIDERS_EXHAUSTED',
      message:
        `All available providers failed. Attempted: ${attempted.join(', ')}. ` +
        `Check provider credentials, circuit breaker states, and network connectivity.`,
      severity: 'fatal',
      attemptedProviders: attempted,
    };

    throw exhaustedError;
  }

  // ─── Public Interface ─────────────────────────────────────────

  /**
   * Initiates a charge across providers with automatic failover.
   * Tries providers in routing order until one succeeds.
   */
  async charge(request: ChargeRequest): Promise<ChargeResponse> {
    return this.withFailover((provider) => provider.charge(request));
  }

  /**
   * Verifies a transaction on a specific provider by name.
   * Provider must be specified since the reference is
   * provider-scoped.
   */
  async verify(
    reference: string,
    providerName: ProviderName
  ): Promise<ChargeResponse> {
    const provider = this.providers.find(
      (p) => p.name === providerName
    );

    if (!provider) {
      throw {
        code: 'PROVIDER_NOT_REGISTERED',
        message: `Provider '${providerName}' is not registered in this PayFuse instance.`,
        severity: 'fatal',
      } satisfies PayFuseError;
    }

    return withRetry(
      () => provider.verify(reference),
      { maxRetries: this.config.retries }
    );
  }

  /**
   * Initiates a refund on a specific provider by name.
   * Provider must be specified since the original transaction
   * belongs to a specific provider.
   */
  async refund(
    request: RefundRequest,
    providerName: ProviderName
  ): Promise<RefundResponse> {
    const provider = this.providers.find(
      (p) => p.name === providerName
    );

    if (!provider) {
      throw {
        code: 'PROVIDER_NOT_REGISTERED',
        message: `Provider '${providerName}' is not registered in this PayFuse instance.`,
        severity: 'fatal',
      } satisfies PayFuseError;
    }

    return withRetry(
      () => provider.refund(request),
      { maxRetries: this.config.retries }
    );
  }

  /**
   * Parses and normalizes a webhook from a specific provider.
   */
  parseWebhook(
    payload: unknown,
    signature: string,
    providerName: ProviderName
  ): WebhookEvent {
    const provider = this.providers.find(
      (p) => p.name === providerName
    );

    if (!provider) {
      throw {
        code: 'PROVIDER_NOT_REGISTERED',
        message: `Provider '${providerName}' is not registered in this PayFuse instance.`,
        severity: 'fatal',
      } satisfies PayFuseError;
    }

    return provider.parseWebhook(payload, signature);
  }

  /**
   * Runs health checks across all registered providers in parallel.
   * Returns a result for each provider regardless of outcome.
   */
  async healthCheck(): Promise<HealthCheckResult[]> {
    return Promise.all(
      this.providers.map((provider) => provider.healthCheck())
    );
  }

  /**
   * Returns the list of currently registered provider names.
   */
  getRegisteredProviders(): ProviderName[] {
    return this.providers.map((p) => p.name);
  }

  /**
   * Returns the list of currently available provider names
   * (not blocked by an open circuit).
   */
  getAvailableProviders(): ProviderName[] {
    return this.router
      .getAvailable(this.providers)
      .map((p) => p.name);
  }

  /**
   * Returns the circuit breaker state for a specific provider.
   * Useful for monitoring dashboards and debugging.
   */
  getCircuitState(provider: ProviderName) {
    return this.circuitBreaker.getState(provider);
  }
}
