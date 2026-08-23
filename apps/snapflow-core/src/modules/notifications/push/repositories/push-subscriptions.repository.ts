import { Injectable } from '@nestjs/common';
import { PushSubscription } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../../database/prisma.service';
import { SavePushSubscriptionApplicationDto } from '../../application/dto/save-push-subscription.application-dto';

@Injectable()
export class PushSubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertByEndpoint(data: SavePushSubscriptionApplicationDto): Promise<PushSubscription> {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: {
        userId: data.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent,
      },
      update: {
        userId: data.userId,
        p256dh: data.p256dh,
        auth: data.auth,
        userAgent: data.userAgent,
      },
    });
  }

  async findByUserId(userId: number): Promise<PushSubscription[]> {
    return this.prisma.pushSubscription.findMany({
      where: { userId },
    });
  }

  async deleteByEndpoint(endpoint: string, userId: number): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint, userId },
    });
  }

  async deleteByEndpointOnly(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });
  }

  async touchLastUsedAt(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.updateMany({
      where: { endpoint },
      data: { lastUsedAt: new Date() },
    });
  }
}
