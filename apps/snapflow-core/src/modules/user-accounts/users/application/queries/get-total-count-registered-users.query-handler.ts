import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TotalCountRegisteredUsersViewDto } from '../../api/dto/view-dto/total-count-registered-users.view-dto';
import { UsersQueryRepository } from '../../infrastructure/users.query-repository';

export class GetTotalCountRegisteredUsersQuery {}

@QueryHandler(GetTotalCountRegisteredUsersQuery)
export class GetTotalCountRegisteredUsersQueryHandler
  implements IQueryHandler<GetTotalCountRegisteredUsersQuery, TotalCountRegisteredUsersViewDto>
{
  constructor(private readonly usersQueryRepository: UsersQueryRepository) {}

  async execute(): Promise<TotalCountRegisteredUsersViewDto> {
    return await this.usersQueryRepository.countAllUsers();
  }
}
