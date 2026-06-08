import type {
  FastifyInstance,
  FastifyRequest,
} from 'fastify';
import type { PayFuseEngine, ProviderName } from '@payfuse/sdk';

/**
 * @package @payfuse/service
 * @description Verify route.
 *
 * GET /verify/:provider/:reference
 * Verifies a transaction status on the specified provider.
 */

interface VerifyParams {
  provider: ProviderName;
  reference: string;
}

const verifySchema = {
  params: {
    type: 'object',
    required: ['provider', 'reference'],
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
      reference: {
        type: 'string',
        minLength: 1,
      },
    },
  },
} as const;

export async function verifyRoutes(
  app: FastifyInstance,
  engine: PayFuseEngine
): Promise<void> {
  /**
   * GET /verify/:provider/:reference
   * Returns the current status of a transaction.
   */
  app.get(
    '/verify/:provider/:reference',
    { schema: verifySchema },
    async (
      request: FastifyRequest<{ Params: VerifyParams }>,
      reply
    ) => {
      const { provider, reference } = request.params;

      const result = await engine.verify(reference, provider);

      reply.code(200).send({
        success: true,
        data: result,
      });
    }
  );
}
