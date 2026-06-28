import { Field, Int, ObjectType } from '@nestjs/graphql';
import { AdminPostMediaModel } from './admin-post-media.model';
import { AdminPostOwnerModel } from './admin-post-owner.model';
import { PostWithMediaAndUserMetadata } from '../../../posts/infrastructure/types/post-with-media-and-user-metadata.type';

@ObjectType()
export class AdminPostListItemModel {
  @Field(() => Int)
  id: number;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field()
  createdAt: Date;

  @Field(() => [AdminPostMediaModel])
  postMedias: AdminPostMediaModel[];

  @Field(() => AdminPostOwnerModel)
  owner: AdminPostOwnerModel;

  static mapToModel(post: PostWithMediaAndUserMetadata): AdminPostListItemModel {
    const model = new AdminPostListItemModel();

    model.id = post.id;
    model.description = post.description;
    model.createdAt = post.createdAt;
    model.postMedias = post.postMedias.map((pm) => AdminPostMediaModel.mapToModel(pm));
    model.owner = AdminPostOwnerModel.mapToModel({
      userId: post.user.id,
      profileId: post.user.profiles[0].id,
      username: post.user.username,
      avatarUrl: post.user.profiles[0]?.avatarUrl,
    });
    return model;
  }
}
