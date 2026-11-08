import { Body, Controller, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import type { Request } from 'express';
import { ApiException } from '../common/api-exception';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { VerifiedUser } from '../auth/jwt-verifier.service';
import { DbService } from '../db/db.service';
import { buildVoteCastPayload } from '../outbox/outbox.relay';

interface CastVoteBody {
  candidateId?: unknown;
  points?: unknown;
}

type AuthedRequest = Request & { user: VerifiedUser; requestId?: string };

/**
 * Vote stub (T1.5): the ballot state change and its `vote.cast` outbox row
 * commit in ONE Postgres transaction — no dual-write, no commit-then-send
 * (ADR-0003). Domain depth (quota, re-vote) lands in Phase 2; this proves
 * the async skeleton. Local JWT verification = service authority (ADR-0007).
 */
@Controller('api/v1/events')
export class VoteController {
  constructor(private readonly db: DbService) {}

  @Post(':eventId/votes')
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  async castVote(
    @Param('eventId') eventId: string,
    @Body() body: CastVoteBody,
    @Req() req: AuthedRequest,
    @Headers('x-request-id') headerRequestId?: string,
  ): Promise<{ eventId: string; candidateId: string; points: number; castAt: string }> {
    const candidateId = typeof body.candidateId === 'string' ? body.candidateId : '';
    const points = typeof body.points === 'number' ? body.points : 0;
    if (!isUuid(eventId) || !isUuid(candidateId)) {
      throw new ApiException('VALIDATION_FAILED', 'eventId and candidateId must be uuids');
    }
    if (!Number.isInteger(points) || points < 1 || points > 10) {
      throw new ApiException('VALIDATION_FAILED', 'points must be an integer 1..10');
    }

    const userId = req.user.id;
    const requestId = req.requestId ?? headerRequestId ?? '';
    const span = trace.getActiveSpan();
    const sc = span?.spanContext();
    const traceparent = sc?.traceId ? `00-${sc.traceId}-${sc.spanId}-01` : undefined;

    const { id, envelope } = buildVoteCastPayload({
      eventId,
      candidateId,
      points,
      userId,
      requestId,
      traceparent,
    });

    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO ballot_stub (event_id, candidate_id, user_id, points)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (event_id, user_id)
         DO UPDATE SET candidate_id = EXCLUDED.candidate_id, points = EXCLUDED.points`,
        [eventId, candidateId, userId, points],
      );
      await client.query(
        `INSERT INTO outbox (id, topic, partition_key, payload, traceparent, request_id)
         VALUES ($1, 'eventista.vote.cast', $2, $3, $4, $5)`,
        [id, eventId, JSON.stringify(envelope), traceparent ?? null, requestId],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Mirror request id on the active span for Jaeger tag search (T1.4).
    span?.setAttribute('request.id', requestId);

    return { eventId, candidateId, points, castAt: new Date().toISOString() };
  }
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}