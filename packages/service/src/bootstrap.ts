import {
  PayFuseEngine,
  PaystackProvider,
  FlutterwaveProvider,
  MtnMomoProvider,
  InterswitchProvider,
  OpayProvider,
} from '@payfuse/sdk';
import { config } from './config';

/**
 * @package @payfuse/service
 * @description PayFuse engine bootstrap.
 *
 * Reads provider configuration from environment variables,
 * builds the PayFuse engine, and registers all enabled providers.
 *
 * Only providers marked `enabled: true` in config are registered.
 * Disabled providers are silently skipped.
 */
export function bootstrapEngine(): PayFuseEngine {
  const { providers, orchestration } = config;

  const engine = new PayFuseEngine({
    strategy: orchestration.strategy,
    retries: orchestration.retries,
    timeout: orchestration.timeout,
    providers: [
      {
        name: 'paystack',
        priority: providers.paystack.priority,
        enabled: providers.paystack.enabled,
        credentials: {},
      },
      {
        name: 'flutterwave',
        priority: providers.flutterwave.priority,
        enabled: providers.flutterwave.enabled,
        credentials: {},
      },
      {
        name: 'mtn-momo',
        priority: providers.mtnMomo.priority,
        enabled: providers.mtnMomo.enabled,
        credentials: {},
      },
      {
        name: 'interswitch',
        priority: providers.interswitch.priority,
        enabled: providers.interswitch.enabled,
        credentials: {},
      },
      {
        name: 'opay',
        priority: providers.opay.priority,
        enabled: providers.opay.enabled,
        credentials: {},
      },
    ],
  });

  if (providers.paystack.enabled) {
    engine.register(
      new PaystackProvider({
        secretKey: providers.paystack.secretKey,
        timeoutMs: orchestration.timeout,
      })
    );
  }

  if (providers.flutterwave.enabled) {
    engine.register(
      new FlutterwaveProvider({
        secretKey: providers.flutterwave.secretKey,
        secretHash: providers.flutterwave.secretHash,
        timeoutMs: orchestration.timeout,
      })
    );
  }

  if (providers.mtnMomo.enabled) {
    engine.register(
      new MtnMomoProvider({
        apiUserId: providers.mtnMomo.apiUserId,
        apiKey: providers.mtnMomo.apiKey,
        subscriptionKey: providers.mtnMomo.subscriptionKey,
        apiSecret: providers.mtnMomo.apiSecret,
        environment: providers.mtnMomo.environment,
        timeoutMs: orchestration.timeout,
      })
    );
  }

  if (providers.interswitch.enabled) {
    engine.register(
      new InterswitchProvider({
        clientId: providers.interswitch.clientId,
        clientSecret: providers.interswitch.clientSecret,
        environment: providers.interswitch.environment,
        timeoutMs: orchestration.timeout,
      })
    );
  }

  if (providers.opay.enabled) {
    engine.register(
      new OpayProvider({
        merchantId: providers.opay.merchantId,
        appSecret: providers.opay.appSecret,
        environment: providers.opay.environment,
        timeoutMs: orchestration.timeout,
      })
    );
  }

  return engine;
}
