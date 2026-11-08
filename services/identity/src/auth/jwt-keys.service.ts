import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';

export interface PublicJwk {
  kty: 'RSA';
  use: 'sig';
  alg: 'RS256';
  kid: string;
  n: string;
  e: string;
}

export interface DevClaims {
  sub: string;
  email: string;
  roles: string[];
}

/**
 * Mock IdP (T1.3 / review finding A2): RS256 keys generated at boot and a JWKS
 * endpoint with the exact contract the Phase 4 issuer will publish — only the
 * OAuth dance is absent. Tokens are signed, never decoded-without-verify (Q-04).
 */
@Injectable()
export class JwtKeysService implements OnModuleInit {
  private privateKey!: ReturnType<typeof createPrivateKey>;
  private publicKey!: ReturnType<typeof createPublicKey>;
  private kid!: string;

  readonly issuer = process.env.JWT_ISSUER ?? 'https://identity.eventista.local';
  readonly audience = process.env.JWT_AUDIENCE ?? 'eventista-api';

  onModuleInit(): void {
    const keyFile = process.env.JWT_PRIVATE_KEY_FILE;
    const pem = keyFile ? readFileSync(keyFile, 'utf8') : process.env.JWT_PRIVATE_KEY_PEM;
    this.privateKey = pem ? createPrivateKey(pem) : generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    this.publicKey = createPublicKey(this.privateKey);
    this.kid = this.computeKid();
  }

  sign(claims: DevClaims, ttlSeconds: number): string {
    return jwt.sign(
      { email: claims.email, roles: claims.roles },
      this.privateKey,
      {
        algorithm: 'RS256',
        keyid: this.kid,
        subject: claims.sub,
        issuer: this.issuer,
        audience: this.audience,
        expiresIn: ttlSeconds,
        jwtid: randomUUID(),
      },
    );
  }

  jwks(): { keys: PublicJwk[] } {
    const jwk = this.publicKey.export({ format: 'jwk' }) as { kty: 'RSA'; n: string; e: string };
    return {
      keys: [{ kty: jwk.kty, use: 'sig', alg: 'RS256', kid: this.kid, n: jwk.n, e: jwk.e }],
    };
  }

  private computeKid(): string {
    const jwk = this.publicKey.export({ format: 'jwk' }) as { kty: string; n: string; e: string };
    const canonical = JSON.stringify({ e: jwk.e, kty: jwk.kty, n: jwk.n });
    return createHash('sha256').update(canonical).digest('base64url').slice(0, 32);
  }
}
