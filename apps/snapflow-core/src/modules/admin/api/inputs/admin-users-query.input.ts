import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, Min } from 'class-validator';
import { adminUsersQueryDefaults } from '../../constants/admin-query.defaults';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminUsersBanStatusFilter } from '../../domain/enums/admin-users-ban-status-filter.enum';
import { AdminUsersSortField } from '../../domain/enums/admin-users-sort-field.enum';

@InputType()
export class AdminUsersQueryInput {
  @Field(() => Int, { defaultValue: adminUsersQueryDefaults.page })
  @IsOptional()
  @Min(1)
  page?: number;

  @Field(() => Int, { defaultValue: adminUsersQueryDefaults.pageSize })
  @IsOptional()
  @Min(1)
  pageSize?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => AdminUsersSortField, {
    nullable: true,
    defaultValue: adminUsersQueryDefaults.sortBy,
  })
  @IsOptional()
  @IsEnum(AdminUsersSortField)
  sortBy?: AdminUsersSortField;

  @Field(() => AdminSortDirection, {
    nullable: true,
    defaultValue: adminUsersQueryDefaults.sortDirection,
  })
  @IsOptional()
  @IsEnum(AdminSortDirection)
  sortDirection?: AdminSortDirection;

  @Field(() => AdminUsersBanStatusFilter, {
    nullable: true,
    defaultValue: adminUsersQueryDefaults.banStatusFilter,
  })
  @IsOptional()
  @IsEnum(AdminUsersBanStatusFilter)
  banStatusFilter?: AdminUsersBanStatusFilter;
}
