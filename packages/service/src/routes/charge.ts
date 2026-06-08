import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PayFuseEngine, ChargeRequest } from '@payfuse/sdk';

/**
 * @package @payfuse/service
 * @description Charge route.
 *
 * POST /charge
 * Initiates a payment across available providers with
 * automatic failover.
 */

interface ChargeBody {
  amount: number;
  currency: string;
  email: string;
  phoneNumber?: string;
  reference?: string;
  callbackUrl?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
}

const chargeSchema = {
  body: {
    type: 'object',
    required: ['amount', 'currency', 'email'],
    properties: {
      amount: {
        type: 'number',
        minimum: 1,
        description: 'Amount in smallest currency unit (kobo, pesewas)',
      },
      currency: {
        type: 'string',
        enum: ['NGN', 'GHS', 'KES', 'ZAR', 'USD'],
      },
      email: {
        type: 'string',
        format: 'email',
      },
      phoneNumber: {
        type: 'string',
        description: 'Required for mobile_money channel. E.164 format.',
      },
      reference: {
        type: 'string',
        description: 'Unique transaction reference. Auto-generated if omitted.',
      },
      callbackUrl: {
        type: 'string',
        format: 'uri',
      },
      channel: {
        type: 'string',
        enum: ['card', 'bank_transfer', 'mobile_money', 'ussd', 'qr'],
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
      },
    },
  },
} as const;

export async function chargeRoutes(
  app: FastifyInstance,
  engine: PayFuseEngine
): Promise<void> {
  /**
   * POST /charge
   * Initiates a payment. Returns an authorizationUrl for
   * redirect-based flows or a pending status for push payments.
   */
  app.post(
    '/charge',
    { schema: chargeSchema },
    async (request: FastifyRequest<{ Body: ChargeBody }>, reply) => {
      const result = await engine.charge(
        request.body as ChargeRequest
      );

      reply.code(201).send({
        success: true,
        data: result,
      });
    }
  );
}
