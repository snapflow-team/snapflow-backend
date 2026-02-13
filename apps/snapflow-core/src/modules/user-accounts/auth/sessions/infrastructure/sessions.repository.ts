import { Injectable } from '@nestjs/common';
import { Prisma, Session } from '@generated/prisma';
import { PrismaService } from '../../../../../database/prisma.service';

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByDeviceId(deviceId: string): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: {
        deviceId,
        deletedAt: null,
      },
    });
  }

  async create(data: Prisma.SessionCreateInput): Promise<Session> {
    return this.prisma.session.create({
      data,
    });
  }

  async softDeleteCurrentSession(id: number): Promise<void> {
    await this.prisma.session.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async softDeleteAllSessionForUser(userId: number): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async hardDeleteOldSoftDeletedSessions(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result: Prisma.BatchPayload = await this.prisma.session.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lte: cutoffDate,
        },
      },
    });

    return result.count;
  }

  async updateSession(id: number, dto: Prisma.SessionUpdateInput): Promise<void> {
    await this.prisma.session.update({
      where: {
        id,
      },
      data: dto,
    });
  }
}
