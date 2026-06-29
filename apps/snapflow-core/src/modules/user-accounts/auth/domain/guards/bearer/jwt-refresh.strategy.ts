import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { SessionContextDto } from '../dto/session-context.dto';
import { SessionsRepository } from '../../../../sessions/infrastructure/sessions.repository';
import { ICookieRequest } from '../interfaces/cookie-request.interface';
import { PayloadRefreshToken } from '../../../application/types/payload-refresh-token.type';
import { UnauthorizedException } from '../../../../../../common/exceptions/domain-exceptions';
import { Session, User } from '@generated/prisma-snapflow';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../../../setup/configuration/api-settings';
import { UsersRepository } from '../../../../users/infrastructure/users.repository';
import { assertAuthUserActive } from '../../utils/assert-auth-user-active';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly sessionsRepository: SessionsRepository,
    private readonly usersRepository: UsersRepository,
  ) {
    const {
      refreshToken: { secret },
    } = configService.get<ApiSettings>('apiSettings').getJwtOptions();

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

    const user: User | null = await this.usersRepository.findUserById(userId);
    assertAuthUserActive(user);

    return {
      userId,
      deviceId,
    };
  }
}
