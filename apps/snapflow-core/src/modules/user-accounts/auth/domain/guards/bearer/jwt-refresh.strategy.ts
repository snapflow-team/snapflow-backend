import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { SessionContextDto } from '../dto/session-context.dto';
import { UserAccountsConfig } from '../../../../config/user-accounts.config';
import { SessionsRepository } from '../../../sessions/infrastructure/sessions.repository';
import { ICookieRequest } from '../interfaces/cookie-request.interface';
import { PayloadRefreshToken } from '../../../application/types/payload-refresh-token.type';
import { UnauthorizedException } from '../../../../../../common/exceptions/domain-exceptions';
import { Session } from '@generated/prisma-snapflow';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly userAccountConfig: UserAccountsConfig,
    private readonly sessionsRepository: SessionsRepository,
  ) {
    const secret: string = userAccountConfig.refreshTokenSecret;

    if (!secret) {
      throw new Error('REFRESH_TOKEN_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: ICookieRequest): string | null => req.cookies?.refreshToken ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: PayloadRefreshToken): Promise<SessionContextDto> {
    const { userId, deviceId, iat } = payload;
    const tokenIssuedDate: Date = new Date(iat * 1000);

    const session: Session | null = await this.sessionsRepository.findByDeviceId(deviceId);

    if (!session || new Date(session.iat).getTime() !== tokenIssuedDate.getTime()) {
      throw new UnauthorizedException('User is not authenticated');
    }

    return {
      userId,
      deviceId,
    };
  }
}
