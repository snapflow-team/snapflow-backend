import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../constants/auth.constants';
import { PayloadAccessToken } from '../types/payload-access-token.type';

@Injectable()
export class AuthTokenService {
  constructor(
    @Inject(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN)
    private readonly accessJwt: JwtService,
  ) {}

  verifyAndDecodeAccessToken(token: string): PayloadAccessToken {
    return this.accessJwt.verify<PayloadAccessToken>(token);
  }
}
