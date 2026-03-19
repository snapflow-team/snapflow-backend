import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { OAuthContextDto } from '../dto/oauth-context.dto';
import { OAuthProvider } from '@generated/prisma-snapflow';
import { ApiSettings } from '../../../../../../setup/configuration/api-settings';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../../../setup/configuration/configuration';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService<Configuration, true>) {
    const googleOauthOptions = configService
      .get<ApiSettings>('apiSettings')
      .getGoogleOauthOptions();

    super({
      ...googleOauthOptions,
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
        provider: OAuthProvider.GOOGLE,
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
