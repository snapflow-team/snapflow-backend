import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminUserListItemModel {
  @Field(() => Int)
  id: number;

  @Field()
  username: string;

  @Field()
  createdAt: Date;

  @Field(() => String, { nullable: true })
  profileLink?: string | null;

  profileId: number | null;
}
