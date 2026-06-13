<div align="center">

# PayFuse

**Unified payment orchestration for Africa.**

One API. Every provider. Automatic failover.

[

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

](https://opensource.org/licenses/MIT) [

![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)

](https://nodejs.org) [

![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)

](https://www.typescriptlang.org)

</div>

---

## The Problem

Every African fintech integrates payment providers independently. When Paystack goes down, transactions fail. When you need to add Flutterwave, you rewrite your payment logic. When MTN MoMo needs a phone number format your system doesn't support, you patch it manually.

Every team solves the same problems. Separately. Repeatedly.

## The Solution

PayFuse sits between your application and every African payment provider. You call one API. PayFuse handles the rest — routing, failover, retries, webhook normalization, and circuit breaking.

```typescript
const result = await payfuse.charge({
  amount: 50000,
  currency: 'NGN',
  email: 'customer@example.com',
});
// PayFuse automatically routes to the best available provider
// and fails over to the next if one goes down
```

---

## Supported Providers

| Provider | Charge | Verify | Refund | Webhooks |
|---|---|---|---|---|
| Paystack | ✅ | ✅ | ✅ | ✅ |
| Flutterwave | ✅ | ✅ | ✅ | ✅ |
| MTN MoMo | ✅ | ✅ | ⚠️ | ✅ |
| Interswitch | ✅ | ✅ | ✅ | ✅ |
| OPay | ✅ | ✅ | ✅ | ✅ |

> ⚠️ MTN MoMo refunds require the Disbursements product.

---

## Architecture

```
Your Application
      ↓
@payfuse/sdk
      ↓
Orchestration Engine
 ├── Provider Router     (priority | round-robin | cost-based)
 ├── Circuit Breaker     (auto-detects unhealthy providers)
 └── Retry Manager       (exponential backoff with jitter)
      ↓
Provider Adapters
 ├── Paystack
 ├── Flutterwave
 ├── MTN MoMo
 ├── Interswitch
 └── OPay
      ↓
Webhook Normalizer → Unified Event Format
```

---

## Packages

| Package | Description |
|---|---|
| `@payfuse/core` | Shared types, interfaces, and contracts |
| `@payfuse/paystack` | Paystack adapter |
| `@payfuse/flutterwave` | Flutterwave adapter |
| `@payfuse/mtn-momo` | MTN MoMo adapter |
| `@payfuse/interswitch` | Interswitch adapter |
| `@payfuse/opay` | OPay adapter |
| `@payfuse/sdk` | Orchestration engine — use this in your app |
| `@payfuse/service` | Hosted REST API service |

---

## Quick Start

### SDK

```typescript
import {
  PayFuseEngine,
  PaystackProvider,
  FlutterwaveProvider,
} from '@payfuse/sdk';

const payfuse = new PayFuseEngine({
  strategy: 'priority',
  retries: 2,
  providers: [
    {
      name: 'paystack',
      priority: 1,
      enabled: true,
      credentials: {},
    },
    {
      name: 'flutterwave',
      priority: 2,
      enabled: true,
      credentials: {},
    },
  ],
});

payfuse
  .register(new PaystackProvider({
    secretKey: process.env.PAYSTACK_SECRET_KEY!,
  }))
  .register(new FlutterwaveProvider({
    secretKey: process.env.FLW_SECRET_KEY!,
    secretHash: process.env.FLW_SECRET_HASH!,
  }));

// Charge
const charge = await payfuse.charge({
  amount: 50000,
  currency: 'NGN',
  email: 'customer@example.com',
  callbackUrl: 'https://yourapp.com/payment/callback',
});

console.log(charge.authorizationUrl);

// Verify
const verification = await payfuse.verify(
  charge.reference,
  charge.provider
);

console.log(verification.status);

// Refund
const refund = await payfuse.refund(
  { reference: charge.reference },
  charge.provider
);

// Parse webhook
const event = payfuse.parseWebhook(
  requestBody,
  req.headers['x-paystack-signature'],
  'paystack'
);

console.log(event.event);
console.log(event.reference);
console.log(event.amount);
```

### REST API Service

```bash
git clone https://github.com/VOTIVEWHEEL/payfuse.git
cd payfuse/packages/service
cp .env.example .env
npm install
npm run build
npm start
```

```bash
# Charge
curl -X POST https://your-payfuse-service.com/charge \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "currency": "NGN",
    "email": "customer@example.com",
    "callbackUrl": "https://yourapp.com/callback"
  }'

# Verify
curl https://your-payfuse-service.com/verify/paystack/pf_abc123 \
  -H "Authorization: Bearer YOUR_API_KEY"

# Refund
curl -X POST https://your-payfuse-service.com/refund/paystack \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "reference": "pf_abc123" }'

# Health check
curl https://your-payfuse-service.com/health/providers \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Webhooks

Point your provider webhook URLs to:

```
POST https://your-payfuse-service.com/webhook/paystack
POST https://your-payfuse-service.com/webhook/flutterwave
POST https://your-payfuse-service.com/webhook/mtn-momo
POST https://your-payfuse-service.com/webhook/interswitch
POST https://your-payfuse-service.com/webhook/opay
```

---

## Routing Strategies

**Priority** *(default)*
Always attempts providers in order of configured priority. If priority 1 fails, tries priority 2, and so on.

**Round-robin**
Distributes load evenly across all available providers.

**Cost-based** *(coming soon)*
Routes to the cheapest provider for the given currency and amount.

---

## Circuit Breaker

PayFuse automatically tracks provider health. After 3 consecutive failures within 60 seconds, a provider's circuit opens and PayFuse stops routing traffic to it. After 30 seconds, it enters a half-open state and tests the provider with a single request. On success, the circuit closes and normal traffic resumes.

```typescript
payfuse.getCircuitState('paystack'); // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
payfuse.getAvailableProviders(); // ['paystack', 'flutterwave']
```

---

## Environment Variables

See [`packages/service/.env.example`](packages/service/.env.example) for the full list.

---

## Contributing

Contributions are welcome. To add a new provider:

1. Create a new package under `packages/providers/your-provider/`
2. Implement the `IPaymentProvider` interface from `@payfuse/core`
3. Follow the same structure as existing adapters
4. Add tests
5. Open a PR against `develop`

---

## Roadmap

- [ ] Cost-based routing strategy
- [ ] Transaction dashboard UI
- [ ] PayFuse Recon — automated financial reconciliation
- [ ] PayFuse Comply — KYC/AML compliance API
- [ ] PayFuse Fraud — real-time fraud scoring
- [ ] PHP SDK

---

## License

MIT © [Joshua Adesanya](https://github.com/VOTIVEWHEEL)

---

<div align="center">
Built for African fintech infrastructure.
</div>
