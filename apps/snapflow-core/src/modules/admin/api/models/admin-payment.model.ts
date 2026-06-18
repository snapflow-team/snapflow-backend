import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminPaymentModel {
  @Field(() => Int)
  userId: number;

  @Field()
  username: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;

  @Field()
  date: string;

  @Field(() => Int)
  amount: number;

  @Field()
  subscriptionType: string;

  @Field()
  provider: string;
}
