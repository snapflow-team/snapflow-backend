import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Request, Response } from 'express';
import { ClientInfoDto } from '../../../../../../../libs/common/dto/client-info.dto';
import { AdminLoginInput } from '../inputs/admin-login.input';
import { AdminAuthPayloadModel } from '../models/admin-auth-payload.model';
import { AdminLoginCommand } from '../../application/usecases/admin-login.usecase';
import { AdminLogoutCommand } from '../../application/usecases/admin-logout.usecase';
import { AdminGqlThrottlerGuard } from '../guards/admin-gql-throttler.guard';
import { AdminGqlAuthGuard } from '../guards/admin-gql-auth.guard';
import { AdminSessionCookieService } from '../../infrastructure/services/admin-session-cookie.service';
import { ExtractAdminClientInfo } from '../decorators/request/extract-admin-client-info.decorator';
import { AdminLoginResult } from '../../application/types/admin-login-result.type';
import { AdminContextDto } from '../../domain/types/admin-context.dto';

type AdminRequest = Request & {
  adminContext?: AdminContextDto;
};

@Resolver()
export class AdminAuthResolver {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly adminSessionCookieService: AdminSessionCookieService,
  ) {}

  @UseGuards(AdminGqlThrottlerGuard)
  @Mutation(() => AdminAuthPayloadModel)
  async adminLogin(
    @Args('input') input: AdminLoginInput,
    @ExtractAdminClientInfo() clientInfo: ClientInfoDto,
    @Context('res') res: Response,
  ): Promise<AdminAuthPayloadModel> {
    const { sessionId }: AdminLoginResult = await this.commandBus.execute(
      new AdminLoginCommand({
        email: input.email,
        password: input.password,
        ip: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      }),
    );

    this.adminSessionCookieService.setSessionCookie(res, sessionId);

    return { success: true };
  }

  @UseGuards(AdminGqlAuthGuard)
  @Mutation(() => AdminAuthPayloadModel)
  async adminLogout(
    // vilyamz[core]: если еще гдето понадобится вытаскивать sessionId, то написать декоратор который будет доставать sessionId.
    @Context('req') req: AdminRequest,
    @Context('res') res: Response,
  ): Promise<AdminAuthPayloadModel> {
    await this.commandBus.execute(
      new AdminLogoutCommand({ sessionId: req.adminContext!.sessionId }),
    );

    this.adminSessionCookieService.clearSessionCookie(res);

    return { success: true };
  }
}
