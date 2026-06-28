import { Args, Query, Resolver, Subscription } from '@nestjs/graphql';
import { Inject, UseFilters, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AdminGqlExceptionsFilter } from '../filters/admin-gql-exceptions.filter';
import { AdminGqlAuthGuard } from '../guards/admin-gql-auth.guard';
import { AdminPostsQueryInput } from '../inputs/admin-posts-query.input';
import { GetAdminPostsQueryParams } from '../../application/dto/get-admin-posts-query.params';
import { PaginatedAdminPostsModel } from '../models/paginated-admin-posts.model';
import { GetAdminPostsQuery } from '../../application/queries/get-admin-posts.query-handler';
import { AdminPostListItemModel } from '../models/admin-post-list-item.model';
import { POST_CREATED_EVENT } from '../../application/events/constants/post-created-event.constant';
import { PubSub } from 'graphql-subscriptions';
import { PUB_SUB } from '../../constants/pub-sub-provider.constant';
import { SubscriptionHandlerName } from '../../constants/subscription-handler-name.constant';

@UseFilters(AdminGqlExceptionsFilter)
@Resolver()
export class AdminPostsResolver {
  constructor(
    private readonly queryBus: QueryBus,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @UseGuards(AdminGqlAuthGuard)
  @Query(() => PaginatedAdminPostsModel)
  async adminPosts(
    @Args('input', { nullable: true }) input?: AdminPostsQueryInput,
  ): Promise<PaginatedAdminPostsModel> {
    const params = new GetAdminPostsQueryParams({
      page: input?.page,
      pageSize: input?.pageSize,
      search: input?.search,
      sortBy: input?.sortBy,
      sortDirection: input?.sortDirection,
    });

    return this.queryBus.execute(new GetAdminPostsQuery(params));
  }

  @UseGuards(AdminGqlAuthGuard)
  @Subscription(() => AdminPostListItemModel, {
    name: SubscriptionHandlerName,
  })
  postCreated() {
    return this.pubSub.asyncIterableIterator(POST_CREATED_EVENT);
  }
}
