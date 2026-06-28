import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ACCESS_TOKEN_STRATEGY_INJECT_TOKEN,
  REFRESH_TOKEN_STRATEGY_INJECT_TOKEN,
} from '../../src/modules/user-accounts/auth/constants/auth.constants';
import { PayloadRefreshToken } from '../../src/modules/user-accounts/auth/application/types/payload-refresh-token.type';
import { PayloadAccessToken } from '../../src/modules/user-accounts/auth/application/types/payload-access-token.type';

@Injectable()
export class AuthTokenTestService {
  constructor(
    @Inject(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN)
    private accessJwt: JwtService,

    @Inject(REFRESH_TOKEN_STRATEGY_INJECT_TOKEN)
    private refreshJwt: JwtService,
  ) {}

  generateRefreshToken(userId: number, deviceId: string) {
    return this.refreshJwt.sign({ userId, deviceId });
  }

  generateAccessToken(userId: number) {
    return this.accessJwt.sign({ userId });
  }
  verifyAndDecodeAccessToken(token: string): PayloadAccessToken {
    return this.accessJwt.verify(token);
  }
  decodeRefreshToken(token: string): PayloadRefreshToken {
    return this.refreshJwt.verify(token);
  }
  generateExpiredAccessToken(userId: number) {
    return this.accessJwt.sign({ userId }, { expiresIn: `${Date.now() - 100}ms` });
  }
  generateAccessTokenLives2s(userId: number) {
    return this.accessJwt.sign({ userId }, { expiresIn: `2s` });
  }
}
