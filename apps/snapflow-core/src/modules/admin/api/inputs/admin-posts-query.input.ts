import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, Min } from 'class-validator';
import { adminPostsQueryDefaults } from '../../constants/admin-query.defaults';
import { AdminSortDirection } from '../../domain/enums/admin-sort-direction.enum';
import { AdminPostsSortField } from '../../domain/enums/admin-posts-sort-field.enum';

@InputType()
export class AdminPostsQueryInput {
  @Field(() => Int, { defaultValue: adminPostsQueryDefaults.page })
  @IsOptional()
  @Min(1)
  page?: number;

  @Field(() => Int, { defaultValue: adminPostsQueryDefaults.pageSize })
  @IsOptional()
  @Min(1)
  pageSize?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => AdminPostsSortField, {
    nullable: true,
    defaultValue: adminPostsQueryDefaults.sortBy,
  })
  @IsOptional()
  @IsEnum(AdminPostsSortField)
  sortBy?: AdminPostsSortField;

  @Field(() => AdminSortDirection, {
    nullable: true,
    defaultValue: adminPostsQueryDefaults.sortDirection,
  })
  @IsOptional()
  @IsEnum(AdminSortDirection)
  sortDirection?: AdminSortDirection;
}
