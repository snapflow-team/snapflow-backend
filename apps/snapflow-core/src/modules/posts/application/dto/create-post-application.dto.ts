import { PostStatus } from '@generated/prisma-snapflow';

export class CreatePostApplicationDto {
  userId: number;
  status: PostStatus;
  description: string | null;
  fileIds: string[];
}
