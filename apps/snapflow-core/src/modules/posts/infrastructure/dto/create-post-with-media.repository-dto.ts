import { PostStatus } from '@generated/prisma-snapflow';
import { CreateMediaInput } from '../../types/create-media.type';

export class CreatePostWithMediaRepositoryDto {
  userId: number;
  status: PostStatus;
  description?: string;
  medias: CreateMediaInput[];
}
