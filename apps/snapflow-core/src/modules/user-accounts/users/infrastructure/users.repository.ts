import { Injectable } from '@nestjs/common';
import { Prisma, User } from '../../../../../generated/prisma';
import { PrismaService } from '../../../../database/prisma.service';

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
}
