import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3002);
  await app.listen(port, '0.0.0.0');
  // Structured boot line — full JSON access logs + traceparent land in T1.4
  new Logger('Bootstrap').log(JSON.stringify({ event: 'listening', port, service: 'voting' }));
}

void bootstrap();
