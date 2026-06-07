import { Query, Resolver } from '@nestjs/graphql';

/** GraphQL requires a Query root; remove when the first real admin query is added. */
@Resolver()
export class AdminSchemaPlaceholderResolver {
  @Query(() => Boolean)
  adminGraphqlReady(): boolean {
    return true;
  }
}
