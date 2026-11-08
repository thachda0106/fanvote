import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiException } from './api-exception';
import { logger } from './logger';

/**
 * Contract Error shape: { code, message, requestId } (all OpenAPI specs).
 * 4xx are client faults (warn); 5xx are bugs (error) — both logged with the
 * correlation id so lines from one request join across languages (T1.6).
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = req.requestId;
    const status =
      exception instanceof ApiException
        ? exception.getStatus()
        : exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const code =
      exception instanceof ApiException
        ? exception.code
        : status === 401
          ? 'UNAUTHORIZED'
          : status === 404
            ? 'NOT_FOUND'
            : status < 500
              ? 'VALIDATION_FAILED'
              : 'INTERNAL_ERROR';
    const message =
      exception instanceof ApiException
        ? exception.message
        : exception instanceof Error
          ? exception.message
          : 'unexpected error';

    const fields = { request_id: requestId, status, code, err: exception };
    if (status >= 500) {
      logger.error(fields, 'request.failed');
    } else {
      logger.warn(fields, 'request.rejected');
    }

    if (!res.headersSent) {
      res.status(status).json({ code, message, requestId });
    }
  }
}
