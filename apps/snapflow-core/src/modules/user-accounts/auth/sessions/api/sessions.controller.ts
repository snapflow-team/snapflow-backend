import { Controller, Delete, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtRefreshAuthGuard } from '../../domain/guards/bearer/jwt-refresh-auth.guard';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DeleteSessionByDeviceIdCommand } from '../application/usecases/delete-session-by-device-id.usecase';
import { ExtractSessionFromRequest } from '../../domain/guards/decorators/extract-session-from-request.decorator';
import { SessionContextDto } from '../../domain/guards/dto/session-context.dto';
import { ValidatedDeviceId } from '../../../../../../../../libs/common/decorators/request/device-id-param.decorator';
import { DeleteActiveSessionsCommand } from '../application/usecases/delete-active-sessions.usercase';
import { GetAllSessionsQuery } from '../application/queries/get-all-sessions.query';
import { SessionsViewDto } from '../../api/view-dto/sessions.view-dto';
import { GetAllSessionsSwagger } from '../swagger/get-all-sessions.swagger';
import { DeleteAllSessionsSwagger } from '../swagger/delete-all-sessions.swagger';
import { DeleteSessionByIdSwagger } from '../swagger/delete-session-by-id.swagger';

@ApiTags('Sessions')
@ApiBearerAuth('refresh-token')
@Controller('sessions')
@UseGuards(JwtRefreshAuthGuard)
@UseGuards(ThrottlerGuard)
export class SessionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @GetAllSessionsSwagger()
  async getAllSessions(
    @ExtractSessionFromRequest() session: SessionContextDto,
  ): Promise<SessionsViewDto[]> {
    return this.queryBus.execute(new GetAllSessionsQuery(session.userId));
  }

  @Delete('terminate-all')
  @DeleteAllSessionsSwagger()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAllSessions(@ExtractSessionFromRequest() session: SessionContextDto) {
    await this.commandBus.execute(new DeleteActiveSessionsCommand(session));
  }

  @Delete(':deviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @DeleteSessionByIdSwagger()
  async deleteSessionByDeviceId(
    @ExtractSessionFromRequest() session: SessionContextDto,
    @ValidatedDeviceId() deviceId: string,
  ): Promise<void> {
    await this.commandBus.execute(new DeleteSessionByDeviceIdCommand(deviceId, session));
  }
}
