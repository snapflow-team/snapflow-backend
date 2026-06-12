import { UseFilters } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { AdminGqlExceptionsFilter } from '../filters/admin-gql-exceptions.filter';

/** GraphQL requires a Query root; remove when the first real admin query is added. */
@UseFilters(AdminGqlExceptionsFilter)
@Resolver()
export class AdminSchemaPlaceholderResolver {
  @Query(() => Boolean)
  adminGraphqlReady(): boolean {
    return true;
  }
}
