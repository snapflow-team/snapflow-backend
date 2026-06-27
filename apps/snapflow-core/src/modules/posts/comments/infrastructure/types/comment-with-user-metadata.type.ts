import { Prisma } from '@generated/prisma-snapflow';

export const commentWithUserMetadataInclude = {
  user: {
    select: {
      id: true,
      username: true,
      profiles: {
        where: { deletedAt: null },
        select: { avatarUrl: true },
        take: 1,
      },
    },
  },
  _count: {
    select: {
      replies: { where: { deletedAt: null } },
      likes: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.CommentInclude;

export type CommentWithUserMetadata = Prisma.CommentGetPayload<{
  include: typeof commentWithUserMetadataInclude;
}>;
