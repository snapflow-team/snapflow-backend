import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { OAuthContextDto } from '../dto/oauth-context.dto';
import { OAuthProvider } from '@generated/prisma-snapflow';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../../../setup/configuration/api-settings';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly configService: ConfigService<Configuration, true>) {
    const githubOauthOptions = configService
      .get<ApiSettings>('apiSettings')
      .getGithubOauthOptions();

    super({
      ...githubOauthOptions,
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
