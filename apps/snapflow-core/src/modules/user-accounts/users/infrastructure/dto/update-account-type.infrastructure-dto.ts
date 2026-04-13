import { AccountType } from '@generated/prisma-snapflow';

export class UpdateAccountTypeInfrastructureDto {
  userId: number;
  accountType: AccountType;
  subscriptionActiveUntil: Date | null;
}
