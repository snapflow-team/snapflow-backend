import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { lastValueFrom } from 'rxjs';
import { ApiSettings } from '../../../setup/configuration/api-settings';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../core/providers/provide-tokens/redis-client.inject-token';
import { Configuration } from '../../../setup/configuration/configuration';
import * as jwt from 'jsonwebtoken';
import { NextjsEndpoints } from './constants/nextjs-endpoints';
import { CryptoService } from '../../../../../../libs/common/services/crypto.service';
import { LoggerFactory } from '../../logger/logger.factory';
import { ContextLogger } from '../../logger/context-logger';

@Injectable()
export class NextjsRevalidationService {
  private readonly logger: ContextLogger;
  private readonly apiSettings: ApiSettings;

  constructor(
    @Inject(REDIS_CLIENT_INJECT_TOKEN) private readonly redis: Redis,
    private readonly httpService: HttpService,
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
  ) {
    this.apiSettings = this.configService.get<ApiSettings>('apiSettings');
    this.logger = loggerFactory.create(NextjsRevalidationService.name);
  }

  async checkAndRevalidatePosts() {
    const count: number = await this.redis.incr('revalidate:posts_count');
    this.logger.log(`New post created. Current un-revalidated count: ${count}`);

    if (count >= 4) {
      const isSuccess: boolean = await this.triggerRevalidation();

      if (isSuccess) {
        await this.redis.set('revalidate:posts_count', 0);
      }
    }
  }

  private async triggerRevalidation(): Promise<boolean> {
    try {
      const secret: string = this.apiSettings.nextjsRevalidationSecret;
      const frontendUrl: string = this.apiSettings.baseFrontUrl;
      const expiresIn = this.apiSettings
        .nextjsRevalidationTokenExpiresIn as jwt.SignOptions['expiresIn'];

      const token: string = this.cryptoService.generateJwtToken(
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

      return true;
    } catch (error) {
      this.logger.error(error, this.triggerRevalidation.name);

      return false;
    }
  }
}
