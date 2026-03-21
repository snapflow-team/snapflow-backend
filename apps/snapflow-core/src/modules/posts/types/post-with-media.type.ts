import { Prisma } from '@generated/prisma-snapflow';

export const postInclude = Prisma.validator<Prisma.PostInclude>()({
  user: {
    select: {
      id: true,
      username: true,
      profiles: {
        where: { deletedAt: null },
        select: { id: true, username: true, firstName: true, lastName: true },
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
});

export type PostWithInclude = Prisma.PostGetPayload<{ include: typeof postInclude }>;
