import { AccountType } from '@generated/prisma-snapflow';

export type RawUserForMe = {
  id: number;
  username: string;
  email: string;
  accountType: AccountType;
};
