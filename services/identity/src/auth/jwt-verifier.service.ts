import { Injectable } from '@nestjs/common';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import jwksClient, { type JwksClient } from 'jwks-rsa';
import { ApiException } from '../common/api-exception';
import { JwtKeysService } from './jwt-keys.service';

export interface VerifiedUser {
  id: string;
  email: string;
  roles: string[];
}

/**
 * Service-authority verification (ADR-0007): fetch/cache JWKS and verify
 * signature + iss + aud + exp locally. Rotation-safe (unknown kid refetches).
 */
@Injectable()
export class JwtVerifierService {
  private readonly client: JwksClient;

  constructor(private readonly keys: JwtKeysService) {
    const url =
      process.env.JWKS_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3001}/jwks`;
    this.client = jwksClient({
      jwksUri: url,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 20,
    });
  }

  async verify(authorization: string | undefined): Promise<VerifiedUser> {
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    if (!token) {
      throw new ApiException('UNAUTHORIZED', 'missing bearer token');
    }

    const payload = await new Promise<JwtPayload>((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          this.client.getSigningKey(header.kid, (err, key) => {
            if (err || !key) {
              callback(err ?? new Error('no signing key for kid'));
              return;
            }
            callback(null, key.getPublicKey());
          });
        },
        {
          algorithms: ['RS256'],
          issuer: this.keys.issuer,
          audience: this.keys.audience,
        },
        (err, decoded) => {
          if (err || !decoded || typeof decoded === 'string') {
            reject(new ApiException('UNAUTHORIZED', 'invalid or expired token'));
            return;
          }
          resolve(decoded);
        },
      );
    });

    return {
      id: String(payload.sub),
      email: String(payload.email ?? ''),
      roles: Array.isArray(payload.roles) ? payload.roles.map(String) : [],
    };
  }
}
