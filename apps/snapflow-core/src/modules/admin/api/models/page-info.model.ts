import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class PageInfoModel {
  @Field(() => Int)
  page: number;

  @Field(() => Int)
  pageSize: number;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Int)
  pagesCount: number;
}
