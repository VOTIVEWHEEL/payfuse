import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { bootstrapEngine } from './bootstrap';
import { healthRoutes } from './routes/health';
import { chargeRoutes } from './routes/charge';
import { verifyRoutes } from './routes/verify';
import { refundRoutes } from './routes/refund';
import { webhookRoutes } from './routes/webhook';

/**
 * @package @payfuse/service
 * @description PayFuse REST API server entry point.
 *
 * Bootstraps the Fastify server with:
 * - Security headers (helmet)
 * - Rate limiting
 * - API key authentication
 * - All PayFuse routes
 * - Global error handling
 */

async function start(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty' }
          : undefined,
    },
  });

  // ─── Security ───────────────────────────────────────────────
  await app.register(helmet);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down.',
      },
    }),
  });

  // ─── Global Error Handler ───────────────────────────────────
  app.setErrorHandler(errorHandler);

  // ─── Engine Bootstrap ───────────────────────────────────────
  const engine = bootstrapEngine();

  app.log.info(
    { providers: engine.getRegisteredProviders() },
    'PayFuse engine bootstrapped'
  );

  // ─── Routes ─────────────────────────────────────────────────

  /**
   * Webhook routes are registered WITHOUT authentication.
   * Provider webhooks authenticate themselves via signatures.
   */
  await webhookRoutes(app, engine);

  /**
   * All other routes require API key authentication.
   */
  app.addHook('preHandler', authenticate);

  await healthRoutes(app, engine);
  await chargeRoutes(app, engine);
  await verifyRoutes(app, engine);
  await refundRoutes(app, engine);

  // ─── Start Server ───────────────────────────────────────────
  try {
    await app.listen({
      port: config.server.port,
      host: config.server.host,
    });

    app.log.info(
      `PayFuse service running on ${config.server.host}:${config.server.port}`
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
