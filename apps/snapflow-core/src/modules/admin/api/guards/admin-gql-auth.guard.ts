import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import { UnauthorizedException } from '../../../../common/exceptions/domain-exceptions';
import { ADMIN_SESSION_COOKIE_NAME } from '../../constants/admin-auth.constants';
import { AdminContextDto } from '../../domain/types/admin-context.dto';
import { AdminRole } from '../../domain/enums/admin-role.enum';
import { AdminSessionsRepository } from '../../infrastructure/repositories/admin-sessions.repository';
import { AdminSessionCookieService } from '../../infrastructure/services/admin-session-cookie.service';
import { AdminSession } from '@generated/prisma-snapflow';

type AdminRequest = Request & {
  adminContext?: AdminContextDto;
};

@Injectable()
export class AdminGqlAuthGuard implements CanActivate {
  constructor(
    private readonly adminSessionsRepository: AdminSessionsRepository,
    private readonly adminSessionCookieService: AdminSessionCookieService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: AdminRequest = this.getRequest(context);
    const sessionId = req.cookies?.[ADMIN_SESSION_COOKIE_NAME] as string | undefined;

    if (!sessionId) {
      throw new UnauthorizedException('Admin is not authenticated');
    }

    const session: AdminSession | null =
      await this.adminSessionsRepository.findActiveById(sessionId);

    if (!session) {
      throw new UnauthorizedException('Admin is not authenticated');
    }

    const expiresAt = new Date(Date.now() + this.adminSessionCookieService.getSessionMaxAgeMs());

    await this.adminSessionsRepository.extendExpiresAt(sessionId, expiresAt);

    req.adminContext = {
      role: AdminRole.SuperAdmin,
      sessionId,
    };

    return true;
  }

  private getRequest(context: ExecutionContext): AdminRequest {
    const gqlContext: GqlExecutionContext = GqlExecutionContext.create(context);

    return gqlContext.getContext<{ req: AdminRequest }>().req;
  }
}
