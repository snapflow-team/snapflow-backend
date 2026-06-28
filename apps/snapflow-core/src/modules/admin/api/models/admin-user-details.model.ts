import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminUserDetailsModel {
  @Field(() => Int)
  id: number;

  @Field()
  username: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;

  @Field()
  createdAt: Date;

  @Field(() => String, { nullable: true })
  profileLink?: string | null;

  profileId?: number | null;
}
