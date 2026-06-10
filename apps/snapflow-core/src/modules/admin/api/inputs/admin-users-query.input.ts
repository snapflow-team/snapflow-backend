import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminUsersSortField } from '../../domain/enums/admin-users-sort-field.enum';

@InputType()
export class AdminUsersQueryInput {
  @Field(() => Int, { defaultValue: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @Field(() => Int, { defaultValue: 8 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pageSize?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => AdminUsersSortField, {
    nullable: true,
    defaultValue: AdminUsersSortField.CreatedAt,
  })
  @IsOptional()
  @IsEnum(AdminUsersSortField)
  sortBy?: AdminUsersSortField;

  @Field(() => AdminSortDirection, {
    nullable: true,
    defaultValue: AdminSortDirection.Descending,
  })
  @IsOptional()
  @IsEnum(AdminSortDirection)
  sortDirection?: AdminSortDirection;
}
