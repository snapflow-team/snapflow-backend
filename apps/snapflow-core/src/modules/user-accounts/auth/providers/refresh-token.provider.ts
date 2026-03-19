import { Provider } from '@nestjs/common';
import { REFRESH_TOKEN_STRATEGY_INJECT_TOKEN } from '../constants/auth.constants';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';

export const RefreshTokenProvider: Provider = {
  provide: REFRESH_TOKEN_STRATEGY_INJECT_TOKEN,
  inject: [ConfigService],

  // todo: разобраться с типизацией expiresIn
  useFactory: (configService: ConfigService<Configuration, true>): JwtService => {
    const { refreshToken } = configService.get<ApiSettings>('apiSettings').getJwtOptions();

    return new JwtService({
      secret: refreshToken.secret,
      signOptions: {
        expiresIn: refreshToken.expiresIn as number,
      },
    });
  },
};
