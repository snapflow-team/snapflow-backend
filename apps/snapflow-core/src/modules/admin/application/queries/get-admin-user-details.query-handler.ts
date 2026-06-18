import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '../../../../common/exceptions/domain-exceptions';
import { AdminUsersQueryRepository } from '../../infrastructure/repositories/admin-users.query-repository';
import { AdminUserDetailsModel } from '../../api/models/admin-user-details.model';

export class GetAdminUserDetailsQuery {
  constructor(public readonly userId: number) {}
}

@QueryHandler(GetAdminUserDetailsQuery)
export class GetAdminUserDetailsQueryHandler
  implements IQueryHandler<GetAdminUserDetailsQuery, AdminUserDetailsModel>
{
  constructor(private readonly adminUsersQueryRepository: AdminUsersQueryRepository) {}

  async execute({ userId }: GetAdminUserDetailsQuery): Promise<AdminUserDetailsModel> {
    const user: AdminUserDetailsModel | null =
      await this.adminUsersQueryRepository.findDetailsById(userId);

    if (!user) {
      throw new NotFoundException(`The user with ID (${userId}) does not exist`);
    }

    return user;
  }
}
