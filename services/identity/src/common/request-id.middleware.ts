import { Injectable, NestMiddleware } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger';
import { httpDuration, httpInFlight, httpRequests, statusClass } from './metrics';

type RequestWithId = Request & { requestId?: string; log?: typeof logger };

/**
 * Correlation id + access log (T1.4/T1.6): honors the edge's X-Request-Id or
 * mints one, mirrors it on the response, tags the active OTel span and emits
 * one structured line on finish. Inbound traceparent is handled by OTel.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const requestId = incoming && incoming.length <= 128 ? incoming : randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const span = trace.getActiveSpan();
    span?.setAttribute('request.id', requestId);
    span?.setAttribute('http.request_id', requestId);

    const started = process.hrtime.bigint();
    const log = logger.child({ request_id: requestId });
    req.log = log;
    httpInFlight.inc();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      const route = (req.route as { path?: string } | undefined)?.path ?? 'unmatched';
      const labels = { method: req.method, route };
      httpRequests.inc({ ...labels, status_class: statusClass(res.statusCode) });
      httpDuration.observe(labels, durationMs / 1000);
      httpInFlight.dec();
      log.info(
        {
          route,
          status: res.statusCode,
          duration_ms: Math.round(durationMs * 100) / 100,
        },
        'request.completed',
      );
    });

    next();
  }
}
