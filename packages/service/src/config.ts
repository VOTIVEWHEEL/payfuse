import 'dotenv/config';

/**
 * @package @payfuse/service
 * @description Centralised environment configuration.
 *
 * All environment variables are read and validated here.
 * No other file should access process.env directly —
 * import from this module instead.
 *
 * Copy `.env.example` to `.env` and fill in your values.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `Check your .env file.`
    );
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function boolEnv(key: string, fallback = false): boolean {
  const val = process.env[key]?.toLowerCase();
  if (val === 'true' || val === '1') return true;
  if (val === 'false' || val === '0') return false;
  return fallback;
}

function intEnv(key: string, fallback: number): number {
  const val = process.env[key];
  const parsed = val ? parseInt(val, 10) : NaN;
  return isNaN(parsed) ? fallback : parsed;
}

export const config = {
  server: {
    port: intEnv('PORT', 3000),
    host: optionalEnv('HOST', '0.0.0.0'),
    /**
     * Secret API key used to authenticate requests to this service.
     * Set a strong random value in production.
     */
    apiKey: requireEnv('PAYFUSE_API_KEY'),
  },

  orchestration: {
    strategy: optionalEnv('PAYFUSE_STRATEGY', 'priority') as
      | 'priority'
      | 'round-robin'
      | 'cost-based',
    retries: intEnv('PAYFUSE_RETRIES', 2),
    timeout: intEnv('PAYFUSE_TIMEOUT', 30_000),
  },

  providers: {
    paystack: {
      enabled: boolEnv('PAYSTACK_ENABLED', false),
      priority: intEnv('PAYSTACK_PRIORITY', 1),
      secretKey: optionalEnv('PAYSTACK_SECRET_KEY', ''),
    },

    flutterwave: {
      enabled: boolEnv('FLUTTERWAVE_ENABLED', false),
      priority: intEnv('FLUTTERWAVE_PRIORITY', 2),
      secretKey: optionalEnv('FLW_SECRET_KEY', ''),
      secretHash: optionalEnv('FLW_SECRET_HASH', ''),
    },

    mtnMomo: {
      enabled: boolEnv('MTN_MOMO_ENABLED', false),
      priority: intEnv('MTN_MOMO_PRIORITY', 3),
      apiUserId: optionalEnv('MTN_API_USER_ID', ''),
      apiKey: optionalEnv('MTN_API_KEY', ''),
      subscriptionKey: optionalEnv('MTN_SUBSCRIPTION_KEY', ''),
      apiSecret: optionalEnv('MTN_API_SECRET', ''),
      environment: optionalEnv('MTN_ENVIRONMENT', 'sandbox') as
        | 'sandbox'
        | 'production',
    },

    interswitch: {
      enabled: boolEnv('INTERSWITCH_ENABLED', false),
      priority: intEnv('INTERSWITCH_PRIORITY', 4),
      clientId: optionalEnv('INTERSWITCH_CLIENT_ID', ''),
      clientSecret: optionalEnv('INTERSWITCH_CLIENT_SECRET', ''),
      environment: optionalEnv(
        'INTERSWITCH_ENVIRONMENT',
        'sandbox'
      ) as 'sandbox' | 'production',
    },

    opay: {
      enabled: boolEnv('OPAY_ENABLED', false),
      priority: intEnv('OPAY_PRIORITY', 5),
      merchantId: optionalEnv('OPAY_MERCHANT_ID', ''),
      appSecret: optionalEnv('OPAY_APP_SECRET', ''),
      environment: optionalEnv('OPAY_ENVIRONMENT', 'sandbox') as
        | 'sandbox'
        | 'production',
    },
  },
} as const;
