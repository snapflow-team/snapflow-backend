import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import { UnauthorizedException } from '../../../../common/exceptions/domain-exceptions';
import { Configuration } from '../../../../setup/configuration/configuration';
import { AdminSettings } from '../../../../setup/configuration/admin-settings';
import { AdminContextDto } from '../../domain/types/admin-context.dto';
import { AdminRole } from '../../domain/enums/admin-role.enum';
import { DateService } from '../../../../../../../libs/common/services/date.service';
import { AdminSessionsRepository } from '../../infrastructure/repositories/admin-sessions.repository';
import { ADMIN_SESSION_COOKIE_NAME } from '../../constants/admin-auth.constants';
import { AdminSession } from '@generated/prisma-snapflow';

type WebSocketRequest = {
  //req : { extra: request: {..}}}
  extra?: {
    request?: AdminRequest;
  };
};
type AdminRequest = Request & {
  //req: {...}
  adminContext?: AdminContextDto;
};

@Injectable()
export class AdminGqlAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly adminSessionsRepository: AdminSessionsRepository,
    private readonly dateService: DateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext: GqlExecutionContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext<{ req: AdminRequest | WebSocketRequest }>();

    const sessionId: string | null = this.parseSessionId(ctx.req);

    if (!sessionId) {
      throw new UnauthorizedException('Admin is not authenticated');
    }

    const session: AdminSession | null =
      await this.adminSessionsRepository.findActiveById(sessionId);

    if (!session) {
      throw new UnauthorizedException('Admin is not authenticated');
    }

    const adminSettings: AdminSettings = this.configService.get<AdminSettings>('adminSettings');
    const expiresAt: Date = this.dateService.generateExpirationDate({
      hours: adminSettings.sessionMaxAgeHours,
    });

    await this.adminSessionsRepository.extendExpiresAt(sessionId, expiresAt);

    if (this.isAdminRequest(ctx.req)) {
      ctx.req.adminContext = {
        role: AdminRole.SuperAdmin,
        sessionId,
      };
    }
    return true;
  }

  private parseSessionId(req: AdminRequest | WebSocketRequest) {
    if (this.isAdminRequest(req)) {
      const rawSessionId: any = req.cookies?.[ADMIN_SESSION_COOKIE_NAME];

      return typeof rawSessionId === 'string' && rawSessionId.length > 0 ? rawSessionId : null;
    }
    if (this.isWebsocketRequest(req)) {
      const rawHeaders = req.extra?.request?.rawHeaders;

      if (!rawHeaders) {
        return null;
      }

      const cookieIndex = rawHeaders.findIndex((item) => item.toLowerCase() === 'cookie');

      const cookieString = cookieIndex !== -1 ? rawHeaders[cookieIndex + 1] : null;
      if (!cookieString) {
        return null;
      }

      const adminSessionIdCookie = cookieString
        .split('; ')
        .find((cookieStr) => cookieStr.startsWith('adminSessionId'))
        ?.split('=')[1];

      return adminSessionIdCookie ? adminSessionIdCookie : null;
    } else {
      return null;
    }
  }

  private isAdminRequest(req: unknown): req is AdminRequest {
    return typeof req === 'object' && req !== null && 'cookies' in req;
  }

  private isWebsocketRequest(req: unknown): req is WebSocketRequest {
    return (
      typeof req === 'object' &&
      req !== null &&
      'extra' in req &&
      typeof req.extra === 'object' &&
      req.extra !== null &&
      'request' in req.extra &&
      typeof req.extra.request === 'object'
    );
  }
}
