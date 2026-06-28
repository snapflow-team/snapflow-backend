import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AdminPostMediaModel {
  @Field(() => Int)
  postMediaId: number;

  @Field(() => String)
  fileId: string;

  @Field(() => String)
  url: string;

  static mapToModel(media: PostMediaRawDbType) {
    const dto = new AdminPostMediaModel();
    dto.postMediaId = media.id;
    dto.fileId = media.fileId;
    dto.url = media.url;
    return dto;
  }
}
type PostMediaRawDbType = {
  id: number;
  fileId: string;
  url: string;
};
