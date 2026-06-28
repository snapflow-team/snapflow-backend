import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminMutationResultModel {
  @Field()
  success: boolean;
}
