import { Field, InputType, Int } from '@nestjs/graphql';
import { IsOptional, Min } from 'class-validator';

@InputType()
export class AdminFollowersQueryInput {
  @Field(() => Int, { defaultValue: 1 })
  @IsOptional()
  @Min(1)
  page?: number;

  @Field(() => Int, { defaultValue: 8 })
  @IsOptional()
  @Min(1)
  pageSize?: number;
}
