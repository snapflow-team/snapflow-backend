import { Prisma } from '@generated/prisma';

export type UserWithPasswordRecoveryCode = Prisma.UserGetPayload<{
  include: {
    passwordRecoveryCode: true;
  };
}>;
