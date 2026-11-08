import { Pool } from 'pg';
import { logger } from '../common/logger';

/**
 * Vote Postgres pool (T1.5). The outbox lives in the same DB as the ballot
 * stub so a state change and its outbox row commit in ONE transaction (ADR-0003).
 * Schema bootstrapped idempotently at startup — real migration framework lands
 * with G-H in T2.9; migrate-test currently no-ops on empty schemas (T0.7).
 */
export class DbService {
  readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ?? 'postgresql://eventista:eventista@localhost:55432/vote',
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }

  async bootstrapSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ballot_stub (
        event_id      uuid        NOT NULL,
        candidate_id  uuid        NOT NULL,
        user_id       text        NOT NULL,
        points        integer     NOT NULL CHECK (points >= 1 AND points <= 10),
        created_at    timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (event_id, user_id)
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS outbox (
        id            uuid        PRIMARY KEY,
        topic         text        NOT NULL,
        partition_key text        NOT NULL,
        payload       jsonb       NOT NULL,
        traceparent   text,
        request_id    text,
        created_at    timestamptz NOT NULL DEFAULT now(),
        claimed_at    timestamptz,
        published_at  timestamptz,
        attempts      integer     NOT NULL DEFAULT 0,
        last_error    text
      );
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS outbox_unpublished_idx
        ON outbox (created_at)
        WHERE published_at IS NULL;
    `);
    logger.info({}, 'vote.schema.bootstrapped');
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}