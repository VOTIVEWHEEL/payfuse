import type {
  FastifyInstance,
  FastifyRequest,
} from 'fastify';
import type { PayFuseEngine, ProviderName } from '@payfuse/sdk';

/**
 * @package @payfuse/service
 * @description Webhook route.
 *
 * POST /webhook/:provider
 * Receives, validates, and normalizes incoming webhook
 * payloads from payment providers.
 *
 * IMPORTANT: This route does NOT require API key auth.
 * Provider webhooks are authenticated via their own
 * signature mechanism validated by each adapter.
 *
 * Point your provider webhook URLs here:
 * https://your-payfuse-service.com/webhook/paystack
 * https://your-payfuse-service.com/webhook/flutterwave
 */

interface WebhookParams {
  provider: ProviderName;
}

const PROVIDER_SIGNATURE_HEADERS: Record<ProviderName, string> = {
  paystack: 'x-paystack-signature',
  flutterwave: 'verif-hash',
  'mtn-momo': 'x-momo-signature',
  interswitch: 'x-interswitch-signature',
  opay: 'sign',
};

export async function webhookRoutes(
  app: FastifyInstance,
  engine: PayFuseEngine
): Promise<void> {
  /**
   * POST /webhook/:provider
   * Validates and normalizes incoming provider webhook.
   *
   * Always returns 200 quickly to acknowledge receipt —
   * providers retry on non-200 responses which can cause
   * duplicate processing.
   */
  app.post(
    '/webhook/:provider',
    async (
      request: FastifyRequest<{ Params: WebhookParams }>,
      reply
    ) => {
      const { provider } = request.params;

      const signatureHeader = PROVIDER_SIGNATURE_HEADERS[provider];
      const signature = request.headers[signatureHeader] as string;

      if (!signature) {
        // Acknowledge receipt but log the missing signature
        request.log.warn(
          { provider },
          `Webhook received without signature header: ${signatureHeader}`
        );

        reply.code(200).send({ received: true });
        return;
      }

      try {
        const event = engine.parseWebhook(
          request.body,
          signature,
          provider
        );

        request.log.info(
          { provider, event: event.event, reference: event.reference },
          'Webhook processed successfully'
        );

        /**
         * Emit the normalized event here.
         * In production, publish to a message queue (Redis, SQS, etc.)
         * for downstream processing. For now we log and acknowledge.
         */
        reply.code(200).send({
          received: true,
          event: event.event,
          reference: event.reference,
        });
      } catch (error: unknown) {
        request.log.error(
          { provider, error },
          'Webhook signature validation failed'
        );

        // Still return 200 to prevent provider retries
        // on genuinely invalid payloads
        reply.code(200).send({ received: false });
      }
    }
  );
}
