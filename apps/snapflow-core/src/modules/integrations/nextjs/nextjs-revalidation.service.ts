import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { ApiSettings } from '../../../setup/configuration/api-settings';
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
    private readonly httpService: HttpService,
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
  ) {
    this.apiSettings = this.configService.get<ApiSettings>('apiSettings');
    this.logger = loggerFactory.create(NextjsRevalidationService.name);
  }

  async triggerRevalidation(): Promise<boolean> {
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
