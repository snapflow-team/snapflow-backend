import { Field, InputType, Int } from '@nestjs/graphql';
import { IsOptional, Min } from 'class-validator';
import { ADMIN_DEFAULT_PAGE, ADMIN_DEFAULT_PAGE_SIZE } from '../../constants/admin-query.defaults';

@InputType()
export class AdminFollowersQueryInput {
  @Field(() => Int, { defaultValue: ADMIN_DEFAULT_PAGE })
  @IsOptional()
  @Min(1)
  page?: number;

  @Field(() => Int, { defaultValue: ADMIN_DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Min(1)
  pageSize?: number;
}
