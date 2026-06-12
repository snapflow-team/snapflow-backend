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

type AdminRequest = Request & {
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
    const req: AdminRequest = this.getRequest(context);
    const rawSessionId: any = req.cookies?.[ADMIN_SESSION_COOKIE_NAME];
    const sessionId: string | undefined =
      typeof rawSessionId === 'string' && rawSessionId.length > 0 ? rawSessionId : undefined;

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
