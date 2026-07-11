import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Configuration } from '../../../setup/configuration/configuration';
import { ApiSettings } from '../../../setup/configuration/api-settings';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../constants/auth.constants';

export const AccessTokenProvider: Provider = {
  provide: ACCESS_TOKEN_STRATEGY_INJECT_TOKEN,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<Configuration, true>): JwtService => {
    const { accessTokenSecret } = configService.get<ApiSettings>('apiSettings');

    return new JwtService({ secret: accessTokenSecret });
  },
};
