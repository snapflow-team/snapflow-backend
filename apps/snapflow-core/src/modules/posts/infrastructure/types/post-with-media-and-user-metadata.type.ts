import { Prisma } from '@generated/prisma-snapflow';

export const postWithMediaAndUserMetadataInclude = {
  user: {
    select: {
      id: true,
      username: true,
      profiles: {
        where: { deletedAt: null },
        select: { id: true, avatarUrl: true },
      },
    },
  },
  postMedias: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      fileId: true,
      url: true,
    },
  },
  _count: {
    select: {
      likes: { where: { deletedAt: null } },
      comments: { where: { deletedAt: null } },
    },
  },
  likes: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      user: {
        select: {
          id: true,
          profiles: {
            where: { deletedAt: null },
            select: { avatarUrl: true },
          },
        },
      },
    },
  },
} satisfies Prisma.PostInclude;

export type PostWithMediaAndUserMetadata = Prisma.PostGetPayload<{
  include: typeof postWithMediaAndUserMetadataInclude;
}>;
