import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { AdminSession, Prisma } from '@generated/prisma-snapflow';

@Injectable()
export class AdminSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.AdminSessionCreateInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<AdminSession> {
    return tx.adminSession.create({ data });
  }

  async findActiveById(
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<AdminSession | null> {
    return tx.adminSession.findFirst({
      where: {
        id,
        deletedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  }

  async softDeleteById(id: string, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.adminSession.updateMany({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async softDeleteAllActive(tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.adminSession.updateMany({
      where: {
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async extendExpiresAt(
    id: string,
    expiresAt: Date,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.adminSession.updateMany({
      where: {
        id,
        deletedAt: null,
      },
      data: {
        expiresAt,
      },
    });
  }
}
