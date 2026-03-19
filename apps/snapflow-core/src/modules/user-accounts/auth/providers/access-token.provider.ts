import { Provider } from '@nestjs/common';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../constants/auth.constants';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';

export const AccessTokenProvider: Provider = {
  provide: ACCESS_TOKEN_STRATEGY_INJECT_TOKEN,
  inject: [ConfigService],

  // todo: разобраться с типизацией expiresIn
  useFactory: (configService: ConfigService<Configuration, true>): JwtService => {
    const { accessToken } = configService.get<ApiSettings>('apiSettings').getJwtOptions();
    return new JwtService({
      secret: accessToken.secret,
      signOptions: {
        expiresIn: accessToken.expiresIn as number,
      },
    });
  },
};
