import { Injectable } from '@nestjs/common';
import { AuthAccount, ConfirmationStatus, OAuthProvider, Prisma, User } from '@generated/prisma';
import { PrismaService } from '../../../../database/prisma.service';
import { UserWithEmailConfirmation } from '../types/user-with-confirmation.type';
import { UserWithPasswordRecoveryCode } from '../types/user-with-password-recovery.type';

@Injectable()
export class UsersRepository {
  constructor(public readonly prisma: PrismaService) {}

  // User ---------------------------------------------------------

  async findUserByEmail(
    email: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<User | null> {
    return tx.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  async findUserByUsername(
    username: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<User | null> {
    return tx.user.findFirst({
      where: {
        username,
        deletedAt: null,
      },
    });
  }

  async findUserByConfirmationCode(
    confirmationCode: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<UserWithEmailConfirmation | null> {
    return tx.user.findFirst({
      where: {
        deletedAt: null,
        emailConfirmationCode: {
          confirmationCode: confirmationCode,
        },
      },
      include: {
        emailConfirmationCode: true,
      },
    });
  }

  async findUserByPasswordRecoveryCode(
    recoveryCode: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<UserWithPasswordRecoveryCode | null> {
    return tx.user.findFirst({
      where: {
        deletedAt: null,
        passwordRecoveryCode: {
          recoveryCode,
        },
      },
      include: {
        passwordRecoveryCode: true,
      },
    });
  }

  async findUserByEmailWithEmailConfirmation(
    email: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<UserWithEmailConfirmation | null> {
    return tx.user.findFirst({
      where: {
        deletedAt: null,
        email,
      },
      include: { emailConfirmationCode: true },
    });
  }

  async findUserByEmailWithPasswordRecoveryCode(
    email: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<UserWithPasswordRecoveryCode | null> {
    return tx.user.findFirst({
      where: {
        deletedAt: null,
        email,
      },
      include: { passwordRecoveryCode: true },
    });
  }

  async createUser(
    data: Prisma.UserCreateInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<User> {
    return tx.user.create({
      data,
      include: {
        emailConfirmationCode: true,
      },
    });
  }

  // Email confirmation ---------------------------------------------------------

  async createEmailConfirmationCodeWithConfirmedStatus(
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.emailConfirmationCode.create({
      data: {
        confirmationStatus: ConfirmationStatus.Confirmed,
        user: {
          connect: { id: userId },
        },
      },
    });
  }

  async confirmEmail(
    params: { code?: string; userId?: number },
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const { code, userId } = params;

    if (!code && !userId) {
      throw new Error('confirmEmail requires code or userId');
    }

    const where = code !== undefined ? { confirmationCode: code } : { userId };

    await tx.emailConfirmationCode.update({
      where,
      data: {
        confirmationStatus: ConfirmationStatus.Confirmed,
        confirmationCode: null,
        expirationDate: null,
      },
    });
  }

  async updateEmailConfirmationCode(
    emailConfirmationCodeId: number,
    expirationDate: Date,
    confirmationCode: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    await tx.emailConfirmationCode.update({
      where: {
        id: emailConfirmationCodeId,
      },
      data: {
        expirationDate,
        confirmationCode,
      },
    });
  }

  // Password recovery ---------------------------------------------------------

  async upsertPasswordRecoveryCode(
    userId: number,
    recoveryCode: string,
    expirationDate: Date,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.passwordRecoveryCode.upsert({
      where: {
        userId,
      },
      create: {
        recoveryCode,
        expirationDate,
        user: {
          connect: { id: userId },
        },
      },
      update: {
        recoveryCode,
        expirationDate,
      },
    });
  }

  async updatePasswordAndResetRecoveryCode(
    userId: number,
    newPasswordHash: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.user.update({
      where: { id: userId },
      data: {
        password: newPasswordHash,
        passwordRecoveryCode: {
          update: {
            recoveryCode: null,
            expirationDate: null,
          },
        },
      },
    });
  }

  async findAccountByProviderAccountIdAndProvider(
    providerAccountId: string,
    provider: OAuthProvider,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<AuthAccount | null> {
    return tx.authAccount.findFirst({
      where: { providerAccountId, provider, deletedAt: null },
    });
  }

  async createAccount(
    data: {
      userId: number;
      provider: OAuthProvider;
      providerAccountId: string;
      email: string;
    },
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<AuthAccount> {
    return tx.authAccount.create({ data });
  }
}
