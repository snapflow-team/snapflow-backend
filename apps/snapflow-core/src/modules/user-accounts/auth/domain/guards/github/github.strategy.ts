import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { UserAccountsConfig } from '../../../../config/user-accounts.config';
import { OAuthProvider } from '@generated/prisma';
import { OAuthContextDto } from '../dto/oauth-context.dto';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly userAccountsConfig: UserAccountsConfig) {
    super({
      clientID: userAccountsConfig.githubOauthClientId,
      clientSecret: userAccountsConfig.googleClientSecret,
      callbackURL: userAccountsConfig.githubOauthCallbackUrl,
      scope: ['user:email'],
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
