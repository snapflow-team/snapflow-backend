import { Field, InputType, Int } from '@nestjs/graphql';
import { IsOptional, Min } from 'class-validator';
import {
  ADMIN_DEFAULT_PAGE,
  ADMIN_DEFAULT_PAGE_SIZE,
  ADMIN_DEFAULT_SORT_DIRECTION,
  ADMIN_DEFAULT_USERS_SORT_BY,
} from '../../constants/admin-query.defaults';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminUsersSortField } from '../../domain/enums/admin-users-sort-field.enum';

@InputType()
export class AdminUsersQueryInput {
  @Field(() => Int, { defaultValue: ADMIN_DEFAULT_PAGE })
  @IsOptional()
  @Min(1)
  page?: number;

  @Field(() => Int, { defaultValue: ADMIN_DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Min(1)
  pageSize?: number;

  @Field(() => String, { nullable: true })
  search?: string;

  @Field(() => AdminUsersSortField, {
    nullable: true,
    defaultValue: ADMIN_DEFAULT_USERS_SORT_BY,
  })
  sortBy?: AdminUsersSortField;

  @Field(() => AdminSortDirection, {
    nullable: true,
    defaultValue: ADMIN_DEFAULT_SORT_DIRECTION,
  })
  sortDirection?: AdminSortDirection;
}
