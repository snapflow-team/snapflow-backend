import { Injectable } from '@nestjs/common';
import { ConfirmationStatus, Prisma, User } from '@generated/prisma';
import { PrismaService } from '../../../../database/prisma.service';
import { UserWithEmailConfirmation } from '../types/user-with-confirmation.type';

@Injectable()
export class UsersRepository {
  constructor(public readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        username,
        deletedAt: null,
      },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
      include: {
        emailConfirmationCode: true,
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

  async confirmEmail(code: string): Promise<void> {
    await this.prisma.emailConfirmationCode.update({
      where: { confirmationCode: code },
      data: {
        confirmationStatus: ConfirmationStatus.Confirmed,
        expirationDate: null,
        confirmationCode: null,
      },
    });
  }
}
