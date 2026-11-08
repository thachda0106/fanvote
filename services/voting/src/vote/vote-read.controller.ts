import { Controller, Get, Param, Query } from '@nestjs/common';

/** Catalog + leaderboard stubs (contract-shaped, Phase 2 fills the domain). */
@Controller('api/v1/events')
export class VoteReadController {
  @Get()
  listEvents(@Query('cursor') _cursor?: string): { items: unknown[]; nextCursor: string | null } {
    return { items: [], nextCursor: null };
  }

  @Get(':eventId')
  getEvent(@Param('eventId') eventId: string): { id: string } {
    return { id: eventId };
  }

  @Get(':eventId/leaderboard')
  leaderboard(
    @Param('eventId') eventId: string,
    @Query('source') source = 'counter',
  ): { eventId: string; source: string; entries: unknown[]; updatedAt: string } {
    return {
      eventId,
      source: source === 'ledger' ? 'ledger' : 'counter',
      entries: [],
      updatedAt: new Date().toISOString(),
    };
  }
}