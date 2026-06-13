import type {
  FastifyError,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
import type { PayFuseError } from '@payfuse/sdk';

/**
 * @package @payfuse/service
 * @description Global error handler for the PayFuse service.
 *
 * Normalizes all error types into a consistent JSON shape
 * so consumers always receive predictable error responses.
 *
 * Response shape:
 * {
 *   success: false,
 *   error: {
 *     code: string,
 *     message: string,
 *     provider?: string
 *   }
 * }
 */

function isPayFuseError(error: unknown): error is PayFuseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'severity' in error
  );
}

export function errorHandler(
  error: FastifyError | unknown,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // PayFuse structured errors
  if (isPayFuseError(error)) {
    const statusCode =
      error.severity === 'fatal' ? 422 : 502;

    reply.code(statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.provider && { provider: error.provider }),
      },
    });
    return;
  }

  // Fastify validation errors
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error
  ) {
    const fastifyError = error as FastifyError;
    reply.code(fastifyError.statusCode ?? 400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: fastifyError.message,
      },
    });
    return;
  }

  // Unknown errors — never expose internals in production
  request.log.error(error);
  reply.code(500).send({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
}
