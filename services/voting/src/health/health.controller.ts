import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { registry } from '../common/metrics';
import { DbService } from '../db/db.service';

/**
 * Observability surface (T1.6): /healthz liveness is datastore-independent;
 * /readyz returns 503 when the vote DB is unreachable (degraded — product
 * rule, D-12); /metrics exposes RED + outbox backlog. Never routed via the
 * gateway (Q-22).
 */
@Controller()
export class HealthController {
  constructor(private readonly db: DbService) {}

  @Get('healthz')
  healthz(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readyz')
  async readyz(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: 'ready' | 'degraded'; checks: { name: string; ok: boolean }[] }> {
    const pg = await this.db.ping();
    if (!pg) res.status(503);
    return { status: pg ? 'ready' : 'degraded', checks: [{ name: 'postgres', ok: pg }] };
  }

  @Get('metrics')
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    return registry.metrics();
  }
}