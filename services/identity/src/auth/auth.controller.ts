import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { ApiException } from '../common/api-exception';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtKeysService } from './jwt-keys.service';
import type { VerifiedUser } from './jwt-verifier.service';

interface TestTokenBody {
  sub?: unknown;
  email?: unknown;
  roles?: unknown;
  ttlSeconds?: unknown;
}

@Controller()
export class AuthController {
  constructor(private readonly keys: JwtKeysService) {}

  @Get('jwks')
  jwks(): { keys: unknown[] } {
    return this.keys.jwks();
  }

  @Post('api/v1/auth/test-token')
  @HttpCode(200)
  testToken(@Body() body: TestTokenBody): {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: number;
  } {
    if ((process.env.AUTH_MODE ?? 'test') !== 'test') {
      throw new ApiException('NOT_FOUND', 'test token issuer is disabled');
    }
    const sub = typeof body.sub === 'string' ? body.sub.trim() : '';
    if (!sub || sub.length > 128) {
      throw new ApiException('VALIDATION_FAILED', 'sub is required');
    }
    const ttl = typeof body.ttlSeconds === 'number' ? body.ttlSeconds : 3600;
    if (!Number.isInteger(ttl) || ttl < 30 || ttl > 86_400) {
      throw new ApiException('VALIDATION_FAILED', 'ttlSeconds must be 30..86400');
    }
    const accessToken = this.keys.sign(
      {
        sub,
        email: typeof body.email === 'string' ? body.email : `${sub}@dev.eventista.local`,
        roles: Array.isArray(body.roles) ? body.roles.map(String) : ['fan'],
      },
      ttl,
    );
    return {
      accessToken,
      refreshToken: `dev-${randomUUID()}`,
      tokenType: 'Bearer',
      expiresIn: ttl,
    };
  }
}

@Controller('api/v1/users')
export class UsersController {
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: VerifiedUser }): VerifiedUser {
    return req.user;
  }
}
