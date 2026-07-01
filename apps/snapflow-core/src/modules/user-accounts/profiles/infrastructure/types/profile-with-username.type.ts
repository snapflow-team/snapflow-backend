import { Prisma } from '@generated/prisma-snapflow';

export type ProfileWithUsername = Prisma.UserProfileGetPayload<{
  include: {
    user: {
      select: {
        username: true;
      };
    };
  };
}>;
