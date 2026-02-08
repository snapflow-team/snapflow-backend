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
}
