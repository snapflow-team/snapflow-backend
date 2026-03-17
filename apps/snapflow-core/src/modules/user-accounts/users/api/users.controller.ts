import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { TotalCountRegisteredUsersViewDto } from './dto/view-dto/total-count-registered-users.view-dto';
import { GetTotalCountRegisteredUsersQuery } from '../application/queries/get-total-count-registered-users.query-handler';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiGetTotalUsersCount } from './swagger/count-all-users.swagger';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('total-count')
  @ApiGetTotalUsersCount()
  @UseGuards(ThrottlerGuard)
  async getTotalCount(): Promise<TotalCountRegisteredUsersViewDto> {
    return this.queryBus.execute(new GetTotalCountRegisteredUsersQuery());
  }
}
