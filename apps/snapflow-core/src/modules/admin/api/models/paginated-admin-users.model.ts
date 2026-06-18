import { Field, ObjectType } from '@nestjs/graphql';
import { AdminUserListItemModel } from './admin-user-list-item.model';
import { PageInfoModel } from './page-info.model';

@ObjectType()
export class PaginatedAdminUsersModel {
  @Field(() => [AdminUserListItemModel])
  items: AdminUserListItemModel[];

  @Field(() => PageInfoModel)
  pageInfo: PageInfoModel;
}
