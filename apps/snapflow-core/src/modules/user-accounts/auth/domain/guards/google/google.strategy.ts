import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { UserAccountsConfig } from '../../../../config/user-accounts.config';
import { Injectable } from '@nestjs/common';
import { OAuthContextDto } from '../dto/oauth-context.dto';
import { OAuthProvider } from '@generated/prisma';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly userAccountConfig: UserAccountsConfig) {
    super({
      clientID: userAccountConfig.googleClientId,
      clientSecret: userAccountConfig.googleClientSecret,
      callbackURL: userAccountConfig.googleCallbackUrl,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<void> {
    try {
      const oauthContextDto: OAuthContextDto = {
        provider: OAuthProvider.GITHUB,
        id: profile.id,
        email: profile.emails?.[0]?.value || null,
        username: profile.username || null,
      };

      done(null, oauthContextDto);
    } catch (err) {
      done(err, null);
    }
  }
}
