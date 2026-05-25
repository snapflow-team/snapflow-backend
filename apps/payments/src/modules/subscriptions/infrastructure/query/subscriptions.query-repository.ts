import { PrismaService } from '../../../database/prisma.service';
import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@generated/prisma-payments';
import { SubscriptionViewDto } from '../../api/view-dto/subscription.view-dto';

@Injectable()
export class SubscriptionsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMyCurrentSubscription(userId: number): Promise<SubscriptionViewDto | null> {
    const foundSubscription = await this.prisma.subscription.findFirst({
      where: {
        deletedAt: null,
        OR: [{ status: SubscriptionStatus.ACTIVE }, { status: SubscriptionStatus.PAST_DUE }],
        customer: {
          userId: userId,
          deletedAt: null,
        },
      },
    });
    if (!foundSubscription) {
      return null;
    }

    return SubscriptionViewDto.mapToView(foundSubscription);
  }
}
