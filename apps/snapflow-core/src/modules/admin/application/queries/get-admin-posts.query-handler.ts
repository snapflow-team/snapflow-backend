import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetAdminPostsQueryParams } from '../dto/get-admin-posts-query.params';
import { AdminPostsQueryRepository } from '../../infrastructure/repositories/admin-posts.query-repository';
import { PaginatedAdminPostsModel } from '../../api/models/paginated-admin-posts.model';

export class GetAdminPostsQuery {
  constructor(public readonly params: GetAdminPostsQueryParams) {}
}

@QueryHandler(GetAdminPostsQuery)
export class GetAdminPostsQueryHandler implements IQueryHandler<GetAdminPostsQuery> {
  constructor(private readonly adminPostsQueryRepository: AdminPostsQueryRepository) {}

  async execute({ params }: GetAdminPostsQuery): Promise<PaginatedAdminPostsModel> {
    return this.adminPostsQueryRepository.findPosts(params);
  }
}
