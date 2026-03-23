import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class CryptoService {
  async createPasswordHash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
  }

  comparePassword({ password, hash }: { password: string; hash: string }): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  generateUUID(): string {
    return randomUUID();
  }

  generateRandomString(sizeBytes: number = 16, encoding: 'hex' | 'base64' = 'hex'): string {
    return randomBytes(sizeBytes).toString(encoding);
  }

  generateShortId(): string {
    return randomBytes(3).toString('hex');
  }

  generateJwtToken(
    payload: Record<string, any>,
    secret: string,
    expiresIn: jwt.SignOptions['expiresIn'] = '1m',
  ): string {
    return jwt.sign(payload, secret, { expiresIn });
  }
}
