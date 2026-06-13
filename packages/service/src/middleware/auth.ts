import type {
  FastifyRequest,
  FastifyReply,
  HookHandlerDoneFunction,
} from 'fastify';
import { config } from '../config';

/**
 * @package @payfuse/service
 * @description API key authentication middleware.
 *
 * Every request must include the API key in the
 * `Authorization` header as a Bearer token:
 *
 * Authorization: Bearer YOUR_PAYFUSE_API_KEY
 *
 * Requests without a valid key receive a 401 response.
 * The comparison uses a timing-safe approach to prevent
 * timing attacks.
 */

/**
 * Performs a constant-time string comparison to prevent
 * timing-based API key enumeration attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

export function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  const authHeader = request.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message:
          'Authorization header is required. ' +
          'Use: Authorization: Bearer YOUR_API_KEY',
      },
    });
    return;
  }

  const providedKey = authHeader.slice('Bearer '.length).trim();

  if (!timingSafeEqual(providedKey, config.server.apiKey)) {
    reply.code(401).send({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'The provided API key is invalid.',
      },
    });
    return;
  }

  done();
}
