import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminPostOwnerModel {
  @Field(() => Int)
  userId: number;

  @Field(() => Int)
  profileId: number;

  @Field(() => String)
  username: string;

  @Field(() => String, { nullable: true })
  avatarUrl: string | null;

  static mapToModel(owner: OwnerRawType): AdminPostOwnerModel {
    const dto = new AdminPostOwnerModel();
    dto.userId = owner.userId;
    dto.profileId = owner.profileId;
    dto.username = owner.username;
    dto.avatarUrl = owner.avatarUrl;
    return dto;
  }
}
type OwnerRawType = {
  userId: number;
  profileId: number;
  username: string;
  avatarUrl: string | null;
};
