import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ExtractUserFromRequest } from '../../../auth/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../auth/guards/dto/user-context.dto';
import { AccessTokenGuard } from '../../../auth/guards/access-token.guard';
import { UpdateActivityStatusCommand } from '../../application/commands/update-activity-status.command';
import { GetPresenceQuery } from '../../application/queries/get-presence.query-handler';
import { GetPresenceQueryParamsDto } from '../../api/input-dto/get-presence.query-params.dto';
import { UpdateActivityStatusInputDto } from '../../api/input-dto/update-activity-status.input-dto';
import { GetPresenceSwagger } from '../../api/swagger/get-presence.swagger';
import { UpdateActivityStatusSwagger } from '../../api/swagger/update-activity-status.swagger';
import { PresenceViewDto } from '../../api/view-dto/presence.view-dto';

@ApiTags('Messenger')
@Controller('messenger')
@UseGuards(AccessTokenGuard)
export class PresenceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('presence')
  @GetPresenceSwagger()
  async getPresence(
    @Query() query: GetPresenceQueryParamsDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<PresenceViewDto[]> {
    return this.queryBus.execute<GetPresenceQuery, PresenceViewDto[]>(
      new GetPresenceQuery(userId, query.userIds),
    );
  }

  @Patch('settings/activity-status')
  @UpdateActivityStatusSwagger()
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateActivityStatus(
    @Body() { showActivityStatus }: UpdateActivityStatusInputDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<void> {
    await this.commandBus.execute(new UpdateActivityStatusCommand({ userId, showActivityStatus }));
  }
}
