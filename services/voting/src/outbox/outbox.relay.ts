import { Injectable } from '@nestjs/common';
import { context, propagation, trace, SpanKind, type Span } from '@opentelemetry/api';
import { randomUUID } from 'node:crypto';
import { logger } from '../common/logger';
import { outboxBacklog } from '../common/metrics';
import { DbService } from '../db/db.service';
import { KafkaService } from '../kafka/kafka.service';

const POLL_MS = 100;
const STALE_MS = 30_000;
const MAX_ATTEMPTS = 10;
const BATCH = 50;

interface OutboxRow {
  id: string;
  topic: string;
  partition_key: string;
  payload: unknown;
  traceparent: string | null;
  request_id: string | null;
  attempts: number;
}

/**
 * Outbox relay (T1.5, ADR-0003 / Q-09): claims rows with
 * UPDATE…SET claimed_at, attempts+1…RETURNING (marking in-tx — never
 * commit-then-send, never session advisory locks), publishes only claimed
 * rows, then stamps published_at. A row is published at-least-once; failure
 * leaves claimed_at set so the stale-claim timeout re-claims it (attempts<10).
 * The relay is the pattern Phase 2 (vote) and Phase 3 (commerce) reuse.
 */
@Injectable()
export class OutboxRelay {
  private timer?: NodeJS.Timeout;
  private gaugeTimer?: NodeJS.Timeout;
  private running = false;
  paused = false;

  constructor(
    private readonly db: DbService,
    private readonly kafka: KafkaService,
  ) {}

  start(): void {
    if (this.timer) return;
    const tick = async (): Promise<void> => {
      if (this.running || this.paused) {
        this.schedule();
        return;
      }
      this.running = true;
      try {
        await this.drain();
      } catch (err) {
        logger.error({ err }, 'outbox.relay.error');
      } finally {
        this.running = false;
        this.schedule();
      }
    };
    void tick();
    // Refresh even while paused so the gauge reflects real backlog (T1.6).
    this.gaugeTimer = setInterval(() => {
      void this.refreshGauge().catch((err: unknown) => {
        logger.warn({ err }, 'outbox.backlog_refresh_failed');
      });
    }, 5_000);
    logger.info({ pollMs: POLL_MS }, 'outbox.relay.started');
  }

  private schedule(): void {
    this.timer = setTimeout(() => void this.tickNow(), POLL_MS);
  }

  private async tickNow(): Promise<void> {
    if (this.running || this.paused) {
      this.schedule();
      return;
    }
    this.running = true;
    try {
      await this.drain();
    } catch (err) {
      logger.error({ err }, 'outbox.relay.error');
    } finally {
      this.running = false;
      this.schedule();
    }
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.gaugeTimer) clearInterval(this.gaugeTimer);
    this.timer = undefined;
    this.gaugeTimer = undefined;
    logger.info({}, 'outbox.relay.stopped');
  }

  async backlog(): Promise<number> {
    const res = await this.db.pool.query(
      'SELECT count(*)::int AS n FROM outbox WHERE published_at IS NULL',
    );
    return res.rows[0].n as number;
  }

  async refreshGauge(): Promise<void> {
    outboxBacklog.set(await this.backlog());
  }

  private async drain(): Promise<void> {
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<OutboxRow>(
        `UPDATE outbox
            SET claimed_at = now(), attempts = attempts + 1
          WHERE id IN (
            SELECT id FROM outbox
             WHERE published_at IS NULL
               AND attempts < $1
               AND (claimed_at IS NULL OR claimed_at < now() - ($2 || ' milliseconds')::interval)
             ORDER BY created_at
             LIMIT $3
             FOR UPDATE SKIP LOCKED
          )
          RETURNING id, topic, partition_key, payload, traceparent, request_id, attempts`,
        [MAX_ATTEMPTS, String(STALE_MS), BATCH],
      );
      await client.query('COMMIT');

      for (const row of rows) {
        try {
          await this.publishRow(row);
          await client.query('UPDATE outbox SET published_at = now(), last_error = NULL WHERE id = $1', [row.id]);
          logger.info(
            { outbox_id: row.id, topic: row.topic, request_id: row.request_id },
            'outbox.published',
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (row.attempts >= MAX_ATTEMPTS) {
            await client.query(
              'UPDATE outbox SET last_error = $1, claimed_at = now() WHERE id = $2',
              [message.slice(0, 500), row.id],
            );
            logger.error({ outbox_id: row.id, attempts: row.attempts, err }, 'outbox.dead');
          } else {
            await client.query('UPDATE outbox SET last_error = $1 WHERE id = $2', [
              message.slice(0, 500),
              row.id,
            ]);
            logger.warn({ outbox_id: row.id, attempts: row.attempts, err }, 'outbox.publish_failed');
          }
        }
      }
      await this.refreshGauge();
    } finally {
      client.release();
    }
  }

  private async publishRow(row: OutboxRow): Promise<void> {
    // Rebuild the producer context from the trace context captured at insert
    // time so the consumer span joins the ORIGINAL request trace (T1.4).
    let parent = context.active();
    if (row.traceparent) {
      const carrier: Record<string, string> = { traceparent: row.traceparent };
      parent = propagation.extract(context.active(), carrier);
    }
    const span: Span = trace.getTracer('voting-outbox').startSpan('vote.cast publish', {
      kind: SpanKind.PRODUCER,
      attributes: {
        'messaging.system': 'kafka',
        'messaging.destination.name': row.topic,
        'messaging.kafka.message.key': row.partition_key,
        'outbox.id': row.id,
      },
    }, parent);

    // AsyncAPI commonHeaders (contracts/asyncapi.yaml) + W3C traceparent from
    // the producer span; x-request-id mirrors correlationId for log joins.
    const envelope = (row.payload ?? {}) as Record<string, unknown>;
    const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
    const headers: Record<string, string> = {
      id: str(envelope.id, row.id),
      type: str(envelope.type, 'vote.cast'),
      occurredAt: str(envelope.occurredAt, new Date().toISOString()),
      producer: str(envelope.producer, 'vote'),
      aggregateId: str(envelope.aggregateId, row.partition_key),
      aggregateType: str(envelope.aggregateType, 'event'),
    };
    propagation.inject(trace.setSpan(context.active(), span), headers);
    if (row.request_id) {
      headers.correlationId = row.request_id;
      headers['x-request-id'] = row.request_id;
    }

    try {
      // Make our producer span the active context for the send: KafkaJS
      // auto-instrumentation then joins THIS trace instead of starting a root
      // trace, and injects that context into the Kafka headers (T1.4).
      await context.with(trace.setSpan(context.active(), span), () =>
        this.kafka.publish(row.topic, row.partition_key, JSON.stringify(row.payload), headers),
      );
    } finally {
      span.end();
    }
  }
}

/** Build the AsyncAPI `voteCast` envelope (headers + payload, T2.8). */
export function buildVoteCastPayload(input: {
  eventId: string;
  candidateId: string;
  points: number;
  userId: string;
  requestId: string;
  traceparent?: string;
}): { id: string; envelope: Record<string, unknown> } {
  const id = randomUUID();
  return {
    id,
    envelope: {
      id,
      type: 'vote.cast',
      occurredAt: new Date().toISOString(),
      producer: 'vote',
      aggregateId: input.eventId,
      aggregateType: 'event',
      traceparent: input.traceparent,
      correlationId: input.requestId,
      eventId: input.eventId,
      candidateId: input.candidateId,
      points: input.points,
      userId: input.userId,
    },
  };
}