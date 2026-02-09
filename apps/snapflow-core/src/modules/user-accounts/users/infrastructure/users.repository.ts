import { Injectable } from '@nestjs/common';
import { ConfirmationStatus, Prisma, User } from '@generated/prisma';
import { PrismaService } from '../../../../database/prisma.service';
import { UserWithEmailConfirmation } from '../types/user-with-confirmation.type';
import { UserWithPasswordRecoveryCode } from '../types/user-with-password-recovery.type';

@Injectable()
export class UsersRepository {
  constructor(public readonly prisma: PrismaService) {}

  // User ---------------------------------------------------------

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  async findUserByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        username,
        deletedAt: null,
      },
    });
  }

  async findUserByConfirmationCode(
    confirmationCode: string,
  ): Promise<UserWithEmailConfirmation | null> {
    return this.prisma.user.findFirst({
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
  ): Promise<UserWithPasswordRecoveryCode | null> {
    return this.prisma.user.findFirst({
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
  ): Promise<UserWithEmailConfirmation | null> {
    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        email,
      },
      include: { emailConfirmationCode: true },
    });
  }

  async findUserByEmailWithPasswordRecoveryCode(
    email: string,
  ): Promise<UserWithPasswordRecoveryCode | null> {
    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        email,
      },
      include: { passwordRecoveryCode: true },
    });
  }

  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
      include: {
        emailConfirmationCode: true,
      },
    });
  }

  // Email confirmation ---------------------------------------------------------

  async confirmEmail(code: string): Promise<void> {
    // TODO Можно ли обращаться к другой сущности
    await this.prisma.emailConfirmationCode.update({
      where: { confirmationCode: code },
      data: {
        confirmationStatus: ConfirmationStatus.Confirmed,
        expirationDate: null,
        confirmationCode: null,
      },
    });
  }

  async updateEmailConfirmationCode(
    emailConfirmationCodeId: number,
    expirationDate: Date,
    confirmationCode: string,
  ) {
    await this.prisma.emailConfirmationCode.update({
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
  ): Promise<void> {
    await this.prisma.passwordRecoveryCode.upsert({
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

  async updatePasswordAndResetRecoveryCode(userId: number, newPasswordHash: string): Promise<void> {
    await this.prisma.user.update({
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
}
