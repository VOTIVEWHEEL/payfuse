import type {
  FastifyInstance,
  FastifyRequest,
} from 'fastify';
import type { PayFuseEngine, ProviderName } from '@payfuse/sdk';

/**
 * @package @payfuse/service
 * @description Refund route.
 *
 * POST /refund/:provider
 * Initiates a full or partial refund on the specified provider.
 */

interface RefundParams {
  provider: ProviderName;
}

interface RefundBody {
  reference: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

const refundSchema = {
  params: {
    type: 'object',
    required: ['provider'],
    properties: {
      provider: {
        type: 'string',
        enum: [
          'paystack',
          'flutterwave',
          'mtn-momo',
          'interswitch',
          'opay',
        ],
      },
    },
  },
  body: {
    type: 'object',
    required: ['reference'],
    properties: {
      reference: {
        type: 'string',
        minLength: 1,
        description: 'The original transaction reference to refund.',
      },
      amount: {
        type: 'number',
        minimum: 1,
        description:
          'Partial refund amount in smallest currency unit. ' +
          'Full refund if omitted.',
      },
      reason: {
        type: 'string',
        description: 'Reason for the refund — stored for audit trail.',
      },
      metadata: {
        type: 'object',
        additionalProperties: true,
      },
    },
  },
} as const;

export async function refundRoutes(
  app: FastifyInstance,
  engine: PayFuseEngine
): Promise<void> {
  /**
   * POST /refund/:provider
   * Initiates a refund. Provider must be specified since
   * the original transaction belongs to a specific provider.
   */
  app.post(
    '/refund/:provider',
    { schema: refundSchema },
    async (
      request: FastifyRequest<{
        Params: RefundParams;
        Body: RefundBody;
      }>,
      reply
    ) => {
      const { provider } = request.params;

      const result = await engine.refund(request.body, provider);

      reply.code(200).send({
        success: true,
        data: result,
      });
    }
  );
}
