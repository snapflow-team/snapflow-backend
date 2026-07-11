import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Configuration } from '../../../setup/configuration/configuration';
import { ApiSettings } from '../../../setup/configuration/api-settings';
import { UnauthorizedException } from '../../../common/exceptions/domain-exceptions';
import { UserContextDto } from './dto/user-context.dto';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { AsyncLocalStorageService } from '../../../common/async-local-storage/async-local-storage.service';
import {
  REQUEST_ID_HEADER,
  REQUEST_ID_KEY,
} from '../../../../../../libs/common/constants/request-id.constants';
import { LoggerFactory } from '../../logger/logger.factory';
import { ContextLogger } from '../../logger/context-logger';

@Injectable()
export class RemoteAuthGuard implements CanActivate {
  private readonly coreUrl: string;
  private readonly logger: ContextLogger;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly httpService: HttpService,
    private readonly asyncLocalStorageService: AsyncLocalStorageService,
    loggerFactory: LoggerFactory,
  ) {
    this.coreUrl = this.configService.get<ApiSettings>('apiSettings').coreServiceUrl;
    this.logger = loggerFactory.create(RemoteAuthGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    let user: UserContextDto;

    try {
      const requestIdValue: unknown = this.asyncLocalStorageService.getStore()?.get(REQUEST_ID_KEY);
      const requestId: string | undefined =
        typeof requestIdValue === 'string' ? requestIdValue : undefined;

      const response = await lastValueFrom(
        this.httpService.get<{ userId: string; email: string; username: string }>(
          `${this.coreUrl}/api/v1/auth/me`,
          {
            headers: {
              Authorization: authHeader,
              ...(requestId !== undefined ? { [REQUEST_ID_HEADER]: requestId } : {}),
            },
          },
        ),
      );

      user = { id: +response.data.userId };
    } catch (error) {
      const message: string = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Error fetching user from core service: ${message}`, this.canActivate.name);
      throw new UnauthorizedException('Invalid or expired token');
    }

    (request as Request & { user: UserContextDto }).user = user;
    return true;
  }
}
