import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AdminUsersQueryRepository } from '../../infrastructure/repositories/admin-users.query-repository';
import { PaginatedAdminUsersModel } from '../../api/models/paginated-admin-users.model';
import { GetAdminUsersQueryParams } from '../dto/get-admin-users-query.params';

export class GetAdminUsersQuery {
  constructor(public readonly params: GetAdminUsersQueryParams) {}
}

@QueryHandler(GetAdminUsersQuery)
export class GetAdminUsersQueryHandler implements IQueryHandler<GetAdminUsersQuery> {
  constructor(private readonly adminUsersQueryRepository: AdminUsersQueryRepository) {}

  async execute({ params }: GetAdminUsersQuery): Promise<PaginatedAdminUsersModel> {
    return this.adminUsersQueryRepository.findMany(params);
  }
}
