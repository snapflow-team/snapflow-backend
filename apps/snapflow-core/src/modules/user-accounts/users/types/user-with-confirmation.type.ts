import { Prisma } from '@generated/prisma-snapflow';

export type UserWithEmailConfirmation = Prisma.UserGetPayload<{
  include: {
    emailConfirmationCode: true;
  };
}>;
