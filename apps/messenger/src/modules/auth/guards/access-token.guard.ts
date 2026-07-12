import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { UnauthorizedException } from '../../../common/exceptions/domain-exceptions';
import { AuthTokenService } from '../application/services/auth-token.service';
import { LoggerFactory } from '../../logger/logger.factory';
import { ContextLogger } from '../../logger/context-logger';
import { UserContextDto } from './dto/user-context.dto';
import { PayloadAccessToken } from '../application/types/payload-access-token.type';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  private readonly logger: ContextLogger;

  constructor(
    private readonly authTokenService: AuthTokenService,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(AccessTokenGuard.name);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader: string | null = request.headers.authorization ?? null;

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token: string | null = this.extractBearerToken(authHeader);

    if (!token) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    try {
      const payload: PayloadAccessToken = this.authTokenService.verifyAndDecodeAccessToken(token);

      (request as Request & { user: UserContextDto }).user = { id: payload.userId };
      return true;
    } catch (error) {
      const message: string = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Error verifying access token: ${message}`, this.canActivate.name);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractBearerToken(authHeader: string): string | null {
    const match = authHeader.match(/^Bearer\s+(\S+)$/i);

    return match?.[1] ?? null;
  }
}
