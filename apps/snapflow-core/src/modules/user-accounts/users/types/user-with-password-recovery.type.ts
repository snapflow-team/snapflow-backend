import { Prisma } from '@generated/prisma-snapflow';

export type UserWithPasswordRecoveryCode = Prisma.UserGetPayload<{
  include: {
    passwordRecoveryCode: true;
  };
}>;
