import { Field, InputType, Int } from '@nestjs/graphql';
import { IsOptional, Min } from 'class-validator';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminUsersSortField } from '../../domain/enums/admin-users-sort-field.enum';

@InputType()
export class AdminUsersQueryInput {
  @Field(() => Int, { defaultValue: 1 })
  @IsOptional()
  @Min(1)
  page?: number;

  @Field(() => Int, { defaultValue: 8 })
  @IsOptional()
  @Min(1)
  pageSize?: number;

  @Field(() => String, { nullable: true })
  search?: string;

  @Field(() => AdminUsersSortField, {
    nullable: true,
    defaultValue: AdminUsersSortField.CreatedAt,
  })
  sortBy?: AdminUsersSortField;

  @Field(() => AdminSortDirection, {
    nullable: true,
    defaultValue: AdminSortDirection.Descending,
  })
  sortDirection?: AdminSortDirection;
}
