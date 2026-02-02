import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';

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
}
