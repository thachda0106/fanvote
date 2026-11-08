import { MiddlewareConsumer, Module, NestModule, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtVerifierService } from './auth/jwt-verifier.service';
import { RequestContextMiddleware } from './common/request-id.middleware';
import { DbService } from './db/db.service';
import { HealthController } from './health/health.controller';
import { KafkaService } from './kafka/kafka.service';
import { OutboxRelay } from './outbox/outbox.relay';
import { TestRelayController } from './vote/test-relay.controller';
import { VoteController } from './vote/vote.controller';
import { VoteReadController } from './vote/vote-read.controller';

const e2eControl = (process.env.E2E_CONTROL ?? 'false') === 'true';

@Module({
  controllers: [
    HealthController,
    VoteReadController,
    VoteController,
    ...(e2eControl ? [TestRelayController] : []),
  ],
  providers: [DbService, KafkaService, OutboxRelay, JwtVerifierService, JwtAuthGuard],
  exports: [DbService, OutboxRelay],
})
export class AppModule implements NestModule, OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly db: DbService,
    private readonly kafka: KafkaService,
    private readonly relay: OutboxRelay,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.db.bootstrapSchema();
    await this.kafka.connect();
    this.relay.start();
  }

  async onModuleDestroy(): Promise<void> {
    this.relay.stop();
    await this.kafka.disconnect();
    await this.db.close();
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}