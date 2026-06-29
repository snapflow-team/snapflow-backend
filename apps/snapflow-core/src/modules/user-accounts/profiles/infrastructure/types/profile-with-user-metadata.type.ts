import { Prisma } from '@generated/prisma-snapflow';

export type ProfileWithUserMetadata = Prisma.UserProfileGetPayload<{
  include: {
    user: {
      include: {
        _count: {
          select: {
            posts: true;
            followers: true;
            following: true;
          };
        };
      };
    };
  };
}>;
