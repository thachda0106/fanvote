import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthController, UsersController } from './auth/auth.controller';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtKeysService } from './auth/jwt-keys.service';
import { JwtVerifierService } from './auth/jwt-verifier.service';
import { RequestContextMiddleware } from './common/request-id.middleware';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController, AuthController, UsersController],
  providers: [JwtKeysService, JwtVerifierService, JwtAuthGuard],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
