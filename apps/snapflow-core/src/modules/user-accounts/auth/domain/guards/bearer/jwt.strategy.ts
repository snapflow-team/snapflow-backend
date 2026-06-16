import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { UserContextDto } from '../dto/user-context.dto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../../../setup/configuration/api-settings';
import { UsersRepository } from '../../../../users/infrastructure/users.repository';
import { UnauthorizedException } from '../../../../../../common/exceptions/domain-exceptions';
import { User } from '@generated/prisma-snapflow';
import { isAuthUserActive } from '../../utils/assert-auth-user-active';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly usersRepository: UsersRepository,
  ) {
    const {
      accessToken: { secret },
    } = configService.get<ApiSettings>('apiSettings').getJwtOptions();

    if (!secret) {
      throw new Error('ACCESS_TOKEN_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { userId: number }): Promise<UserContextDto> {
    const user: User | null = await this.usersRepository.findUserById(payload.userId);
    if (!isAuthUserActive(user)) {
      throw new UnauthorizedException('User is not authenticated');
    }

    return {
      id: user.id,
    };
  }
}
