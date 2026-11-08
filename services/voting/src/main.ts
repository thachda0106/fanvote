import './tracing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { logger } from './common/logger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3002);
  await app.listen(port, '0.0.0.0');
  logger.info({ event: 'listening', port }, 'service.started');
}

void bootstrap();