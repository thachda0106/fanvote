import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const service = process.env.OTEL_SERVICE_NAME ?? process.env.SERVICE_NAME ?? 'voting';

export const registry = new Registry();
registry.setDefaultLabels({ service });
collectDefaultMetrics({ register: registry });

/** RED series (T1.6). Labels stay bounded — never event_id/user_id (R-27). */
export const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'HTTP requests by method, route template and status class',
  labelNames: ['method', 'route', 'status_class'],
  registers: [registry],
});

export const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpInFlight = new Gauge({
  name: 'http_in_flight_requests',
  help: 'HTTP requests currently being served',
  registers: [registry],
});

/** Outbox backlog = unpublished rows (T1.6 / plan: outbox backlog gauge). */
export const outboxBacklog = new Gauge({
  name: 'outbox_backlog',
  help: 'Unpublished outbox rows awaiting the relay',
  registers: [registry],
});

export function statusClass(status: number): string {
  return `${Math.floor(status / 100)}xx`;
}