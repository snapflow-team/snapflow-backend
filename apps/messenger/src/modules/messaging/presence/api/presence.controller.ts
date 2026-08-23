import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { ExtractUserFromRequest } from '../../../auth/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../auth/guards/dto/user-context.dto';
import { AccessTokenGuard } from '../../../auth/guards/access-token.guard';
import { GetPresenceQuery } from '../application/queries/get-presence.query-handler';
import { GetPresenceQueryParamsDto } from './input-dto/get-presence.query-params.dto';
import { GetPresenceSwagger } from './swagger/get-presence.swagger';
import { PresenceViewDto } from './view-dto/presence.view-dto';

@ApiTags('Messenger: presence')
@Controller('messenger/presence')
@UseGuards(AccessTokenGuard)
export class PresenceController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @GetPresenceSwagger()
  async getPresence(
    @Query() query: GetPresenceQueryParamsDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<PresenceViewDto[]> {
    return this.queryBus.execute<GetPresenceQuery, PresenceViewDto[]>(
      new GetPresenceQuery(userId, query.userIds),
    );
  }
}
