import { Field, ObjectType } from '@nestjs/graphql';
import { PageInfoModel } from './page-info.model';
import { AdminPostListItemModel } from './admin-post-list-item.model';

@ObjectType()
export class PaginatedAdminPostsModel {
  @Field(() => [AdminPostListItemModel])
  items: AdminPostListItemModel[];

  @Field(() => PageInfoModel)
  pageInfo: PageInfoModel;
}
