import { User } from '@generated/prisma-snapflow';

export const isAuthUserActive = (user: User | null): user is User =>
  Boolean(user && !user.deletedAt && !user.isBanned);
