import { Args, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseFilters, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Configuration } from '../../../../setup/configuration/configuration';
import { AdminGqlExceptionsFilter } from '../filters/admin-gql-exceptions.filter';
import { AdminGqlAuthGuard } from '../guards/admin-gql-auth.guard';
import { AdminUsersQueryInput } from '../inputs/admin-users-query.input';
import { AdminUserListItemModel } from '../models/admin-user-list-item.model';
import { PaginatedAdminUsersModel } from '../models/paginated-admin-users.model';
import { GetAdminUsersQuery } from '../../application/queries/get-admin-users.query-handler';
import { GetAdminUsersQueryParams } from '../../application/dto/get-admin-users-query.params';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { AdminMutationResultModel } from '../models/admin-mutation-result.model';
import { DeleteUserByAdminCommand } from '../../application/usecases/delete-user-by-admin.usecase';
import { BanUserByAdminCommand } from '../../application/usecases/ban-user-by-admin.usecase';
import { UnbanUserByAdminCommand } from '../../application/usecases/unban-user-by-admin.usecase';
import { UserBanReason } from '../../domain/enums/user-ban-reason.enum';
import { BanUserByAdminApplicationDto } from '../../application/dto/ban-user-by-admin-application.dto';

@UseFilters(AdminGqlExceptionsFilter)
@Resolver(() => AdminUserListItemModel)
export class AdminUsersResolver {
  private readonly apiSettings: ApiSettings;

  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    configService: ConfigService<Configuration, true>,
  ) {
    this.apiSettings = configService.get<ApiSettings>('apiSettings');
  }

  @UseGuards(AdminGqlAuthGuard)
  @Query(() => PaginatedAdminUsersModel)
  async adminUsers(
    @Args('input', { nullable: true }) input?: AdminUsersQueryInput,
  ): Promise<PaginatedAdminUsersModel> {
    const params = new GetAdminUsersQueryParams({
      page: input?.page,
      pageSize: input?.pageSize,
      search: input?.search,
      sortBy: input?.sortBy,
      sortDirection: input?.sortDirection,
    });

    return this.queryBus.execute(new GetAdminUsersQuery(params));
  }

  @UseGuards(AdminGqlAuthGuard)
  @Mutation(() => AdminMutationResultModel)
  async deleteUser(
    @Args('userId', { type: () => Int }) userId: number,
  ): Promise<AdminMutationResultModel> {
    await this.commandBus.execute(new DeleteUserByAdminCommand(userId));

    return { success: true };
  }

  @UseGuards(AdminGqlAuthGuard)
  @Mutation(() => AdminMutationResultModel)
  async banUser(
    @Args('userId', { type: () => Int }) userId: number,
    @Args('reason', { type: () => UserBanReason }) reason: UserBanReason,
    @Args('customReason', { type: () => String, nullable: true }) customReason?: string,
  ): Promise<AdminMutationResultModel> {
    await this.commandBus.execute(
      new BanUserByAdminCommand(new BanUserByAdminApplicationDto(userId, reason, customReason)),
    );

    return { success: true };
  }

  @UseGuards(AdminGqlAuthGuard)
  @Mutation(() => AdminMutationResultModel)
  async unbanUser(
    @Args('userId', { type: () => Int }) userId: number,
  ): Promise<AdminMutationResultModel> {
    await this.commandBus.execute(new UnbanUserByAdminCommand(userId));

    return { success: true };
  }

  @ResolveField(() => String, { nullable: true })
  profileLink(@Parent() user: AdminUserListItemModel): string | null {
    if (!user.profileId) {
      return null;
    }

    return `${this.apiSettings.baseFrontUrl.replace(/\/$/, '')}/profile/${user.profileId}`;
  }
}
