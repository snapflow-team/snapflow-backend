import { Injectable } from '@nestjs/common';
import { Notification, NotificationType, Prisma } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: {
      message: string;
      userId: number;
      payload: Prisma.InputJsonValue;
      type: NotificationType;
    },
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Notification> {
    return tx.notification.create({
      data: {
        message: data.message,
        type: data.type,
        payload: data.payload,
        userId: data.userId,
      },
    });
  }

  async markAllAsRead(userId: number, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.notification.updateMany({
      where: { userId, deletedAt: null },
      data: {
        isRead: true,
      },
    });
  }
}
