import { Controller, Get, Header } from '@nestjs/common';
import { Registry, collectDefaultMetrics } from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({ register: registry });

/**
 * Observability-only surface (T0.5): /healthz liveness is datastore-
 * independent; /readyz returns 503 when degraded (D-12 — checks wired in
 * Phase 6, never boot-fail on a datastore blip, R-17); /metrics exposes RED.
 */
@Controller()
export class HealthController {
  @Get('healthz')
  healthz(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readyz')
  readyz(): { status: 'ready' | 'degraded'; checks: { name: string; ok: boolean }[] } {
    // Phase 0: no datastore checks yet. Phase 6 adds them and flips to 503.
    return { status: 'ready', checks: [] };
  }

  @Get('metrics')
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    return registry.metrics();
  }
}
