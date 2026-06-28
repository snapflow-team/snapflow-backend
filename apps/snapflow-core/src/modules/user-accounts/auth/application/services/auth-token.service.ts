import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ACCESS_TOKEN_STRATEGY_INJECT_TOKEN,
  REFRESH_TOKEN_STRATEGY_INJECT_TOKEN,
} from '../../constants/auth.constants';
import { PayloadRefreshToken } from '../types/payload-refresh-token.type';
import { PayloadAccessToken } from '../types/payload-access-token.type';

@Injectable()
export class AuthTokenService {
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
}
