import { Controller, Delete, Get, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtRefreshAuthGuard } from '../domain/guards/bearer/jwt-refresh-auth.guard';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { DeleteSessionByDeviceIdCommand } from '../sessions/application/usecases/delete-session-by-device-id.usecase';
import { ExtractSessionFromRequest } from '../domain/guards/decorators/extract-session-from-request.decorator';
import { SessionContextDto } from '../domain/guards/dto/session-context.dto';
import { DeviceIdParam } from '../../../../../../../libs/common/decorators/request/device-id-param.decorator';
import { DeleteActiveSessionsCommand } from '../sessions/application/usecases/delete-active-sessions.usercase';
import { GetAllSessionsQuery } from '../sessions/application/queries/get-all-sessions.query';
import { SessionView } from './view-dto/sessions.view-dto';

@ApiTags('Sessions')
@Controller('sessions')
@UseGuards(JwtRefreshAuthGuard)
@UseGuards(ThrottlerGuard)
export class SessionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async getSessions(
    @ExtractSessionFromRequest() session: SessionContextDto,
  ): Promise<SessionView[]> {
    return this.queryBus.execute(new GetAllSessionsQuery(session.userId));
  }

  @Delete('terminate-all')
  async deleteAllSessions(@ExtractSessionFromRequest() session: SessionContextDto) {
    await this.commandBus.execute(new DeleteActiveSessionsCommand(session));
  }

  @Delete(':deviceId')
  async deleteSessionByDeviceId(
    @ExtractSessionFromRequest() session: SessionContextDto,
    @DeviceIdParam() deviceId: string,
  ): Promise<void> {
    await this.commandBus.execute(new DeleteSessionByDeviceIdCommand(deviceId, session));
  }
}
