import { Injectable } from '@nestjs/common';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import jwksClient, { type JwksClient } from 'jwks-rsa';
import { ApiException } from '../common/api-exception';

export interface VerifiedUser {
  id: string;
  email: string;
  roles: string[];
}

/**
 * Service-authority verification (ADR-0007): fetch/cache the identity JWKS and
 * verify signature + iss + aud + exp locally. Rotation-safe (unknown kid refetches).
 * Voting never signs tokens — it only trusts the identity issuer.
 */
@Injectable()
export class JwtVerifierService {
  private readonly client: JwksClient;
  private readonly issuer: string;
  private readonly audience: string;

  constructor() {
    this.issuer = process.env.JWT_ISSUER ?? 'https://identity.eventista.local';
    this.audience = process.env.JWT_AUDIENCE ?? 'eventista-api';
    const url =
      process.env.JWKS_URL ?? 'http://identity:3001/jwks';
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
          issuer: this.issuer,
          audience: this.audience,
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