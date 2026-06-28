import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseFilters, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AdminGqlExceptionsFilter } from '../filters/admin-gql-exceptions.filter';
import { AdminGqlAuthGuard } from '../guards/admin-gql-auth.guard';
import { AdminPaymentsQueryInput } from '../inputs/admin-payments-query.input';
import { PaginatedAdminPaymentsModel } from '../models/paginated-admin-payments.model';
import { GetAdminPaymentsQuery } from '../../application/queries/get-admin-payments.query-handler';
import { GetAdminPaymentsQueryParams } from '../../application/dto/get-admin-payments-query.params';

@UseFilters(AdminGqlExceptionsFilter)
@Resolver()
export class AdminPaymentsResolver {
  constructor(private readonly queryBus: QueryBus) {}

  @UseGuards(AdminGqlAuthGuard)
  @Query(() => PaginatedAdminPaymentsModel)
  async adminPayments(
    @Args('input', { nullable: true }) input?: AdminPaymentsQueryInput,
  ): Promise<PaginatedAdminPaymentsModel> {
    const params = new GetAdminPaymentsQueryParams({
      page: input?.page,
      pageSize: input?.pageSize,
      search: input?.search,
      sortBy: input?.sortBy,
      sortDirection: input?.sortDirection,
    });

    return this.queryBus.execute(new GetAdminPaymentsQuery(params));
  }
}
