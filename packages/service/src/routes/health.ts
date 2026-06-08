import type { FastifyInstance } from 'fastify';
import type { PayFuseEngine } from '@payfuse/sdk';

/**
 * @package @payfuse/service
 * @description Health check routes.
 *
 * GET /health         — Basic liveness check (no auth required)
 * GET /health/providers — Deep provider health checks (auth required)
 */

export async function healthRoutes(
  app: FastifyInstance,
  engine: PayFuseEngine
): Promise<void> {
  /**
   * GET /health
   * Liveness probe — confirms the service is running.
   * No authentication required (used by load balancers).
   */
  app.get('/health', async (_request, reply) => {
    reply.code(200).send({
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
    });
  });

  /**
   * GET /health/providers
   * Readiness probe — checks all registered providers.
   * Returns availability and latency per provider.
   * Authentication required.
   */
  app.get('/health/providers', async (_request, reply) => {
    const results = await engine.healthCheck();

    const allAvailable = results.every((r) => r.available);

    reply.code(allAvailable ? 200 : 207).send({
      success: allAvailable,
      providers: results,
      timestamp: new Date().toISOString(),
    });
  });
}
