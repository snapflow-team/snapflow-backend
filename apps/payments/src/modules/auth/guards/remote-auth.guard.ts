import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Configuration } from '../../../setup/configuration/configuration';
import { ApiSettings } from '../../../setup/configuration/api-settings';
import { UnauthorizedException } from '../../../common/exceptions/domain-exceptions'; // кастомный!
import { UserContextDto } from './dto/user-context.dto';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class RemoteAuthGuard implements CanActivate {
  private readonly coreUrl: string;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly httpService: HttpService,
    private readonly logger: Logger = new Logger(RemoteAuthGuard.name),
  ) {
    this.coreUrl = this.configService.get<ApiSettings>('apiSettings').coreServiceUrl;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    let user: UserContextDto;

    try {
      const response = await lastValueFrom(
        this.httpService.get<{ id: number }>(`${this.coreUrl}/api/v1/auth/me`, {
          headers: { Authorization: authHeader },
        }),
      );

      user = { id: response.data.id };
    } catch (error) {
      this.logger.warn(`Error fetching user from core service: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    (request as Request & { user: UserContextDto }).user = user;
    return true;
  }
}
