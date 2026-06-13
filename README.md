<div align="center">

# PayFuse

**Unified payment orchestration for Africa.**

One API. Every provider. Automatic failover.

[

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

](https://opensource.org/licenses/MIT)
[

![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)

](https://nodejs.org)
[

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
  amount: 50000,  // NGN 500
  currency: 'NGN',
  email: 'customer@example.com',
});
// PayFuse automatically routes to the best available provider
// and fails over to the next if one goes down
