import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma-snapflow';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ConsumedEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async tryConsume(eventId: string, source: string): Promise<boolean> {
    try {
      await this.prisma.consumedEvent.create({
        data: { eventId, source },
      });

      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }

      throw error;
    }
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.prisma.consumedEvent.deleteMany({
      where: { consumedAt: { lt: date } },
    });

    return result.count;
  }
}
