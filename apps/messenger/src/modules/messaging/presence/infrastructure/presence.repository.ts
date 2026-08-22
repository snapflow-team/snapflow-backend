import { Injectable } from '@nestjs/common';
import { UserPresenceSettings } from '@generated/prisma-messenger';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PresenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: number): Promise<UserPresenceSettings | null> {
    return this.prisma.userPresenceSettings.findUnique({
      where: { userId },
    });
  }

  async getSettingsMap(userIds: number[]): Promise<Map<number, UserPresenceSettings>> {
    const settingsMap = new Map<number, UserPresenceSettings>();
    if (userIds.length === 0) {
      return settingsMap;
    }

    const rows = await this.prisma.userPresenceSettings.findMany({
      where: { userId: { in: userIds } },
    });

    for (const row of rows) {
      settingsMap.set(row.userId, row);
    }

    return settingsMap;
  }

  async upsertSettings(
    userId: number,
    showActivityStatus: boolean,
  ): Promise<UserPresenceSettings> {
    return this.prisma.userPresenceSettings.upsert({
      where: { userId },
      create: {
        userId,
        showActivityStatus,
      },
      update: {
        showActivityStatus,
      },
    });
  }

  async updateLastSeen(userId: number, at: Date): Promise<void> {
    await this.prisma.userPresenceSettings.upsert({
      where: { userId },
      create: {
        userId,
        lastSeenAt: at,
      },
      update: {
        lastSeenAt: at,
      },
    });
  }
}
