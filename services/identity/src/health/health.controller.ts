import { Controller, Get, Header } from '@nestjs/common';
import { registry } from '../common/metrics';

/**
 * Observability surface (T1.6): /healthz liveness is datastore-independent;
 * /readyz check wiring lands in Phase 6 (D-12, never boot-fail on a blip, R-17);
 * /metrics exposes RED series and is never routed through the gateway (Q-22).
 */
@Controller()
export class HealthController {
  @Get('healthz')
  healthz(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readyz')
  readyz(): { status: 'ready'; checks: { name: string; ok: boolean }[] } {
    return { status: 'ready', checks: [] };
  }

  @Get('metrics')
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    return registry.metrics();
  }
}
