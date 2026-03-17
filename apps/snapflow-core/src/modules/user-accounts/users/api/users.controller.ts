import { ApiTags } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { TotalCountRegisteredUsersViewDto } from './dto/view-dto/total-count-registered-users.view-dto';
import {
  GetTotalCountRegisteredUsersQuery
} from '../application/queries/get-total-count-registered-users.query-handler';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('total-count')
  async getTotalCount(): Promise<TotalCountRegisteredUsersViewDto> {
    return this.queryBus.execute(new GetTotalCountRegisteredUsersQuery());
  }
}
