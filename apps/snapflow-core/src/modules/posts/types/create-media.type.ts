import { Prisma } from '@generated/prisma-snapflow';

export type CreateMediaInput = {
  fileId: string;
  url: string;
  mimeType: string;
  size: number;
  position: number;
};

export type PostWithMedia = Prisma.PostGetPayload<{ include: { postMedias: true } }>;
