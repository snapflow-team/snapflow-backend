import { Prisma } from '@generated/prisma';

export type UserWithEmailConfirmation = Prisma.UserGetPayload<{
  include: {
    emailConfirmationCode: true;
  };
}>;
