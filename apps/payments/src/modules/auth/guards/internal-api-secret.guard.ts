import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Configuration } from '../../../setup/configuration/configuration';
import { ApiSettings } from '../../../setup/configuration/api-settings';
import { UnauthorizedException } from '../../../common/exceptions/domain-exceptions';
import { INTERNAL_API_SECRET_HEADER } from 'libs/contracts/payments';

@Injectable()
export class InternalApiSecretGuard implements CanActivate {
  private readonly internalApiSecret: string;

  constructor(private readonly configService: ConfigService<Configuration, true>) {
    this.internalApiSecret = this.configService.get<ApiSettings>('apiSettings').internalApiSecret;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedSecret = request.headers[INTERNAL_API_SECRET_HEADER];

    if (typeof providedSecret !== 'string' || providedSecret !== this.internalApiSecret) {
      throw new UnauthorizedException('Invalid internal API secret');
    }

    return true;
  }
}
