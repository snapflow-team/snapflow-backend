import { Prisma } from '@generated/prisma-snapflow';

export type PostWithMediaAndUserMetadata = Prisma.PostGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        username: true;
        profiles: {
          where: { deletedAt: null };
          select: { id: true; avatarUrl: true };
        };
      };
    };
    postMedias: {
      where: { deletedAt: null };
      orderBy: { position: 'asc' };
      select: {
        id: true;
        fileId: true;
        url: true;
      };
    };
  };
}>;
