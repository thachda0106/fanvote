import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { OutboxRelay } from '../outbox/outbox.relay';

/**
 * E2E-only relay control (T1.5 negative test: "kill the relay → outbox rows
 * accumulate → relay restart → docs appear"). Mounted ONLY when E2E_CONTROL=true;
 * never routed through the gateway (path is /__test/*, not /api/v1/*).
 */
@Controller('__test/relay')
export class TestRelayController {
  constructor(private readonly relay: OutboxRelay) {}

  @Post('pause')
  @HttpCode(200)
  pause(): { paused: boolean } {
    this.relay.paused = true;
    return { paused: true };
  }

  @Post('resume')
  @HttpCode(200)
  resume(): { paused: boolean } {
    this.relay.paused = false;
    return { paused: false };
  }

  /** DB-truth backlog (the /metrics gauge is scrape-time refreshed). */
  @Get('backlog')
  async backlog(): Promise<{ backlog: number }> {
    return { backlog: await this.relay.backlog() };
  }
}