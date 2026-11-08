import { trace } from '@opentelemetry/api';
import pino from 'pino';

const service = process.env.OTEL_SERVICE_NAME ?? process.env.SERVICE_NAME ?? 'voting';

/**
 * Structured JSON logs for every line (T1.6). The active OTel span is mixed in
 * at call time so sync handlers, async callbacks and Kafka consumers all carry
 * trace_id/span_id. request_id is bound per request by RequestContextMiddleware.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  mixin() {
    const spanContext = trace.getActiveSpan()?.spanContext();
    return spanContext?.traceId
      ? { trace_id: spanContext.traceId, span_id: spanContext.spanId }
      : {};
  },
});
