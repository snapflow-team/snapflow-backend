import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { UserContextDto } from '../dto/user-context.dto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../../../setup/configuration/api-settings';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService<Configuration, true>) {
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

  validate(payload: { userId: number }): UserContextDto {
    return {
      id: payload.userId,
    };
  }
}
