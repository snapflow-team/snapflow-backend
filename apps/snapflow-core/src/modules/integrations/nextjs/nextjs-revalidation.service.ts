import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { lastValueFrom } from 'rxjs';
import { ApiSettings } from '../../../setup/configuration/api-settings';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../core/providers/provide-tokens/redis-client.inject-token';
import { Configuration } from '../../../setup/configuration/configuration';
import { AuthTokenService } from '../../../../../../libs/common/services/auth-token.service';
import * as jwt from 'jsonwebtoken';
import { NextjsEndpoints } from './constants/nextjs-endpoints';

@Injectable()
export class NextjsRevalidationService {
  private readonly logger: Logger = new Logger(NextjsRevalidationService.name);
  private readonly apiSettings: ApiSettings;

  constructor(
    @Inject(REDIS_CLIENT_INJECT_TOKEN) private readonly redis: Redis,
    private readonly httpService: HttpService,
    private readonly tokensService: AuthTokenService,
    private readonly configService: ConfigService<Configuration, true>,
  ) {
    this.apiSettings = this.configService.get<ApiSettings>('apiSettings');
  }

  async checkAndRevalidatePosts() {
    const count: number = await this.redis.incr('revalidate:posts_count');
    this.logger.log(`New post created. Current un-revalidated count: ${count}`);

    if (count >= 4) {
      await this.triggerRevalidation();
      await this.redis.set('revalidate:posts_count', 0);
    }
  }

  private async triggerRevalidation() {
    try {
      const secret: string = this.apiSettings.nextjsRevalidationSecret;
      const frontendUrl: string = this.apiSettings.baseFrontUrl;
      const expiresIn = this.apiSettings
        .nextjsRevalidationTokenExpiresIn as jwt.SignOptions['expiresIn'];

      const token: string = this.tokensService.generateWebhookToken(
        { action: 'revalidate_home' },
        secret,
        expiresIn,
      );
      await lastValueFrom(
        this.httpService.post(
          `${frontendUrl}${NextjsEndpoints.Revalidate}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );
      this.logger.log('Successfully triggered Next.js revalidation');
    } catch (error) {
      this.logger.error('Failed to trigger Next.js revalidation', error.message);
    }
  }
}
