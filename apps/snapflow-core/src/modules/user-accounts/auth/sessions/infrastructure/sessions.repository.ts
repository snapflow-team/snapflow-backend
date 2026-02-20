import { Injectable } from '@nestjs/common';
import { Prisma, Session } from '@generated/prisma';
import { PrismaService } from '../../../../../database/prisma.service';

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByDeviceId(
    deviceId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Session | null> {
    return tx.session.findFirst({
      where: {
        deviceId,
        deletedAt: null,
      },
    });
  }

  async create(
    data: Prisma.SessionCreateInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Session> {
    return tx.session.create({
      data,
    });
  }

  async softDeleteCurrentSession(
    id: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.session.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async softDeleteAllSessionForUser(
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.session.updateMany({
      where: {
        userId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async hardDeleteOldSoftDeletedSessions(
    daysOld: number = 90,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result: Prisma.BatchPayload = await tx.session.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lte: cutoffDate,
        },
      },
    });

    return result.count;
  }

  async updateSession(
    id: number,
    dto: Prisma.SessionUpdateInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.session.update({
      where: {
        id,
      },
      data: dto,
    });
  }
}
