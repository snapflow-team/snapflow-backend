import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SearchUsersQueryParamsDto } from '../../api/dto/input-dto/search-users.query-params.dto';
import { SearchUsersPageViewDto } from '../../api/dto/view-dto/search-users-page.view-dto';
import { UsersQueryRepository } from '../../infrastructure/users.query-repository';

export class SearchUsersQuery {
  constructor(public readonly query: SearchUsersQueryParamsDto) {}
}

@QueryHandler(SearchUsersQuery)
export class SearchUsersQueryHandler implements IQueryHandler<SearchUsersQuery> {
  constructor(private readonly usersQueryRepository: UsersQueryRepository) {}

  async execute({ query }: SearchUsersQuery): Promise<SearchUsersPageViewDto> {
    return this.usersQueryRepository.searchUsers(query);
  }
}
