import { Provider } from '@nestjs/common';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../constants/auth.constants';
import { UserAccountsConfig } from '../../config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';

export const AccessTokenProvider: Provider = {
  provide: ACCESS_TOKEN_STRATEGY_INJECT_TOKEN,
  inject: [UserAccountsConfig],

  // todo: разобраться с типизацией expiresIn
  useFactory: (userAccountConfig: UserAccountsConfig): JwtService => {
    return new JwtService({
      secret: userAccountConfig.accessTokenSecret,
      signOptions: {
        expiresIn: userAccountConfig.accessTokenExpireIn as number,
      },
    });
  },
};
