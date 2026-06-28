import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { TotalCountRegisteredUsersViewDto } from './dto/view-dto/total-count-registered-users.view-dto';
import { GetTotalCountRegisteredUsersQuery } from '../application/queries/get-total-count-registered-users.query-handler';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiGetTotalUsersCount } from './swagger/count-all-users.swagger';
import { JwtAuthGuard } from '../../auth/domain/guards/bearer/jwt-auth.guard';
import { SearchUsersQueryParamsDto } from './dto/input-dto/search-users.query-params.dto';
import { SearchUsersPageViewDto } from './dto/view-dto/search-users-page.view-dto';
import { SearchUsersQuery } from '../application/queries/search-users.query-handler';
import { ApiSearchUsers } from './swagger/search-users.swagger';

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

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiSearchUsers()
  async searchUsers(@Query() query: SearchUsersQueryParamsDto): Promise<SearchUsersPageViewDto> {
    return this.queryBus.execute(new SearchUsersQuery(query));
  }
}
