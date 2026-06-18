import { Args, Int, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { UseFilters, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryBus } from '@nestjs/cqrs';
import { Configuration } from '../../../../setup/configuration/configuration';
import { AdminGqlExceptionsFilter } from '../filters/admin-gql-exceptions.filter';
import { AdminGqlAuthGuard } from '../guards/admin-gql-auth.guard';
import { AdminUserDetailsModel } from '../models/admin-user-details.model';
import { GetAdminUserDetailsQuery } from '../../application/queries/get-admin-user-details.query-handler';
import { ApiSettings } from '../../../../setup/configuration/api-settings';

@UseFilters(AdminGqlExceptionsFilter)
@Resolver(() => AdminUserDetailsModel)
export class AdminUserDetailsResolver {
  private readonly apiSettings: ApiSettings;

  constructor(
    private readonly queryBus: QueryBus,
    configService: ConfigService<Configuration, true>,
  ) {
    this.apiSettings = configService.get<ApiSettings>('apiSettings');
  }

  @UseGuards(AdminGqlAuthGuard)
  @Query(() => AdminUserDetailsModel)
  async adminUserDetails(
    @Args('userId', { type: () => Int }) userId: number,
  ): Promise<AdminUserDetailsModel> {
    return this.queryBus.execute(new GetAdminUserDetailsQuery(userId));
  }

  @ResolveField(() => String, { nullable: true })
  profileLink(@Parent() user: AdminUserDetailsModel): string | null {
    if (!user.profileId) {
      return null;
    }

    return `${this.apiSettings.baseFrontUrl.replace(/\/$/, '')}/profile/${user.profileId}`;
  }
}
